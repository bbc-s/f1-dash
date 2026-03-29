use anyhow::Error;
use cached::proc_macro::io_cached;
use chrono::{DateTime, Datelike, NaiveDate, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::error;

const JOLPICA_BASE: &str = "https://api.jolpi.ca/ergast/f1";

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    kind: String,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Round {
    name: String,
    country_name: String,
    country_key: Option<String>,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    sessions: Vec<Session>,
    over: bool,
}

#[derive(Deserialize, Debug)]
struct JolpicaResponse {
    #[serde(rename = "MRData")]
    mr_data: MrData,
}

#[derive(Deserialize, Debug)]
struct MrData {
    #[serde(rename = "RaceTable")]
    race_table: RaceTable,
}

#[derive(Deserialize, Debug)]
struct RaceTable {
    #[serde(rename = "Races")]
    races: Vec<Race>,
}

#[derive(Deserialize, Debug)]
struct SessionDate {
    date: String,
    time: Option<String>,
}

#[derive(Deserialize, Debug)]
struct Circuit {
    #[serde(rename = "Location")]
    location: Location,
}

#[derive(Deserialize, Debug)]
struct Location {
    country: String,
}

#[derive(Deserialize, Debug)]
struct Race {
    #[serde(rename = "raceName")]
    race_name: String,
    #[serde(rename = "Circuit")]
    circuit: Circuit,
    date: String,
    time: Option<String>,
    #[serde(rename = "FirstPractice")]
    first_practice: Option<SessionDate>,
    #[serde(rename = "SecondPractice")]
    second_practice: Option<SessionDate>,
    #[serde(rename = "ThirdPractice")]
    third_practice: Option<SessionDate>,
    #[serde(rename = "SprintQualifying")]
    sprint_qualifying: Option<SessionDate>,
    #[serde(rename = "Sprint")]
    sprint: Option<SessionDate>,
    #[serde(rename = "Qualifying")]
    qualifying: Option<SessionDate>,
}

fn parse_datetime_utc(date: &str, time: Option<&str>) -> Result<DateTime<Utc>, Error> {
    match time {
        Some(time) => {
            let combined = format!("{date} {time}");
            let dt = NaiveDateTime::parse_from_str(&combined, "%Y-%m-%d %H:%M:%SZ")?;
            Ok(DateTime::from_naive_utc_and_offset(dt, Utc))
        }
        None => {
            let date = NaiveDate::parse_from_str(date, "%Y-%m-%d")?;
            let dt = date
                .and_hms_opt(0, 0, 0)
                .ok_or_else(|| anyhow::anyhow!("invalid datetime"))?;
            Ok(DateTime::from_naive_utc_and_offset(dt, Utc))
        }
    }
}

fn make_session(kind: &str, item: Option<&SessionDate>, default_end_hours: i64) -> Result<Option<Session>, Error> {
    let Some(item) = item else {
        return Ok(None);
    };
    let start = parse_datetime_utc(&item.date, item.time.as_deref())?;
    let end = start + chrono::Duration::hours(default_end_hours);

    Ok(Some(Session {
        kind: kind.to_string(),
        start,
        end,
    }))
}

fn country_key(country_name: &str) -> Option<String> {
    let key = match country_name {
        "Australia" => "aus",
        "Austria" => "aut",
        "Azerbaijan" => "aze",
        "Bahrain" => "brn",
        "Belgium" => "bel",
        "Brazil" => "bra",
        "Canada" => "can",
        "China" => "chn",
        "Spain" => "esp",
        "France" => "fra",
        "Great Britain" | "United Kingdom" => "gbr",
        "Germany" => "ger",
        "Hungary" => "hun",
        "Italy" => "ita",
        "Japan" => "jpn",
        "Saudi Arabia" => "ksa",
        "Mexico" => "mex",
        "Monaco" => "mon",
        "Netherlands" => "ned",
        "Portugal" => "por",
        "Qatar" => "qat",
        "Singapore" => "sgp",
        "United Arab Emirates" => "uae",
        "United States" => "usa",
        _ => return None,
    };

    Some(key.to_string())
}

fn race_to_round(race: Race) -> Result<Round, Error> {
    let mut sessions = Vec::new();

    if let Some(item) = make_session("Practice 1", race.first_practice.as_ref(), 1)? {
        sessions.push(item);
    }
    if let Some(item) = make_session("Practice 2", race.second_practice.as_ref(), 1)? {
        sessions.push(item);
    }
    if let Some(item) = make_session("Practice 3", race.third_practice.as_ref(), 1)? {
        sessions.push(item);
    }
    if let Some(item) = make_session("Sprint Qualifying", race.sprint_qualifying.as_ref(), 1)? {
        sessions.push(item);
    }
    if let Some(item) = make_session("Sprint", race.sprint.as_ref(), 1)? {
        sessions.push(item);
    }
    if let Some(item) = make_session("Qualifying", race.qualifying.as_ref(), 1)? {
        sessions.push(item);
    }

    let race_start = parse_datetime_utc(&race.date, race.time.as_deref())?;
    let race_end = race_start + chrono::Duration::hours(2);
    sessions.push(Session {
        kind: "Race".to_string(),
        start: race_start,
        end: race_end,
    });

    sessions.sort_unstable_by(|a, b| a.start.cmp(&b.start));

    let start = sessions
        .first()
        .map(|s| s.start)
        .ok_or_else(|| anyhow::anyhow!("round has no sessions"))?;
    let end = sessions
        .last()
        .map(|s| s.end)
        .ok_or_else(|| anyhow::anyhow!("round has no sessions"))?;

    let now = Utc::now();
    let over = end < now;
    let country_name = race.circuit.location.country;

    Ok(Round {
        name: race.race_name,
        country_key: country_key(&country_name),
        country_name,
        start,
        end,
        sessions,
        over,
    })
}

#[io_cached(
    map_error = r##"|e| anyhow::anyhow!(format!("disk cache error {:?}", e))"##,
    disk = true,
    time = 900
)]
async fn get_schedule(year: i32) -> Result<Vec<Round>, Error> {
    let url = format!("{JOLPICA_BASE}/{year}.json?limit=100");
    let data = reqwest::get(url).await?.json::<JolpicaResponse>().await?;

    let mut rounds = Vec::new();
    for race in data.mr_data.race_table.races {
        if let Ok(round) = race_to_round(race) {
            rounds.push(round);
        }
    }

    rounds.sort_unstable_by(|a, b| a.start.cmp(&b.start));
    Ok(rounds)
}

pub async fn get() -> Result<axum::Json<Vec<Round>>, axum::http::StatusCode> {
    let year = Utc::now().year();
    match get_schedule(year).await {
        Ok(schedule) => Ok(axum::Json(schedule)),
        Err(err) => {
            error!(?err, year, "failed to create schedule");
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_next() -> Result<axum::Json<Round>, axum::http::StatusCode> {
    let year = Utc::now().year();
    match get_schedule(year).await {
        Ok(schedule) => {
            let next = schedule.into_iter().find(|round| !round.over);
            match next {
                Some(round) => Ok(axum::Json(round)),
                None => Err(axum::http::StatusCode::NO_CONTENT),
            }
        }
        Err(err) => {
            error!(?err, year, "failed to create next schedule");
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_parse_datetime_with_time() {
        let dt = parse_datetime_utc("2026-03-08", Some("04:00:00Z")).unwrap();
        assert_eq!(dt.to_rfc3339(), "2026-03-08T04:00:00+00:00");
    }

    #[test]
    fn should_build_round_from_race() {
        let race = Race {
            race_name: "Australian Grand Prix".to_string(),
            circuit: Circuit {
                location: Location {
                    country: "Australia".to_string(),
                },
            },
            date: "2026-03-08".to_string(),
            time: Some("04:00:00Z".to_string()),
            first_practice: Some(SessionDate {
                date: "2026-03-06".to_string(),
                time: Some("01:30:00Z".to_string()),
            }),
            second_practice: None,
            third_practice: None,
            sprint_qualifying: None,
            sprint: None,
            qualifying: Some(SessionDate {
                date: "2026-03-07".to_string(),
                time: Some("05:00:00Z".to_string()),
            }),
        };

        let round = race_to_round(race).unwrap();
        assert_eq!(round.country_name, "Australia");
        assert_eq!(round.country_key.as_deref(), Some("aus"));
        assert!(round.sessions.iter().any(|s| s.kind == "Race"));
    }
}
