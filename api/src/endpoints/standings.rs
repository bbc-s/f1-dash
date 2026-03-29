use anyhow::Error;
use axum::extract::Query;
use cached::proc_macro::io_cached;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::error;

const JOLPICA_BASE: &str = "https://api.jolpi.ca/ergast/f1";

#[derive(Debug, Deserialize)]
pub struct StandingsQuery {
    season: Option<String>,
    round: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DriverStanding {
    position: u32,
    points: f64,
    wins: u32,
    driver_id: String,
    code: Option<String>,
    given_name: String,
    family_name: String,
    constructor_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConstructorStanding {
    position: u32,
    points: f64,
    wins: u32,
    constructor_id: String,
    name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StandingsResponse {
    season: String,
    round: String,
    drivers: Vec<DriverStanding>,
    constructors: Vec<ConstructorStanding>,
    source: String,
}

#[derive(Debug, Deserialize)]
struct JolpicaStandingsResponse {
    #[serde(rename = "MRData")]
    mr_data: MrData,
}

#[derive(Debug, Deserialize)]
struct MrData {
    #[serde(rename = "StandingsTable")]
    standings_table: StandingsTable,
}

#[derive(Debug, Deserialize)]
struct StandingsTable {
    season: String,
    round: String,
    #[serde(rename = "StandingsLists")]
    standings_lists: Vec<StandingsList>,
}

#[derive(Debug, Deserialize)]
struct StandingsList {
    #[serde(rename = "DriverStandings")]
    driver_standings: Option<Vec<RawDriverStanding>>,
    #[serde(rename = "ConstructorStandings")]
    constructor_standings: Option<Vec<RawConstructorStanding>>,
}

#[derive(Debug, Deserialize)]
struct RawDriverStanding {
    position: String,
    points: String,
    wins: String,
    #[serde(rename = "Driver")]
    driver: RawDriver,
    #[serde(rename = "Constructors")]
    constructors: Vec<RawConstructor>,
}

#[derive(Debug, Deserialize)]
struct RawConstructorStanding {
    position: String,
    points: String,
    wins: String,
    #[serde(rename = "Constructor")]
    constructor: RawConstructor,
}

#[derive(Debug, Deserialize)]
struct RawDriver {
    #[serde(rename = "driverId")]
    driver_id: String,
    code: Option<String>,
    #[serde(rename = "givenName")]
    given_name: String,
    #[serde(rename = "familyName")]
    family_name: String,
}

#[derive(Debug, Deserialize)]
struct RawConstructor {
    #[serde(rename = "constructorId")]
    constructor_id: String,
    name: String,
}

fn parse_u32(input: &str) -> u32 {
    input.parse::<u32>().unwrap_or_default()
}

fn parse_f64(input: &str) -> f64 {
    input.parse::<f64>().unwrap_or_default()
}

async fn fetch_driver_standings(
    season: &str,
    round: &str,
) -> Result<(String, String, Vec<DriverStanding>), Error> {
    let url = format!("{JOLPICA_BASE}/{season}/{round}/driverStandings.json");
    let response = reqwest::get(url)
        .await?
        .json::<JolpicaStandingsResponse>()
        .await?;

    let season = response.mr_data.standings_table.season;
    let round = response.mr_data.standings_table.round;
    let list = response
        .mr_data
        .standings_table
        .standings_lists
        .into_iter()
        .next()
        .and_then(|l| l.driver_standings)
        .unwrap_or_default();

    let mapped = list
        .into_iter()
        .map(|item| DriverStanding {
            position: parse_u32(&item.position),
            points: parse_f64(&item.points),
            wins: parse_u32(&item.wins),
            driver_id: item.driver.driver_id,
            code: item.driver.code,
            given_name: item.driver.given_name,
            family_name: item.driver.family_name,
            constructor_name: item
                .constructors
                .first()
                .map(|c| c.name.clone())
                .unwrap_or_else(|| "Unknown".to_string()),
        })
        .collect::<Vec<_>>();

    Ok((season, round, mapped))
}

async fn fetch_constructor_standings(
    season: &str,
    round: &str,
) -> Result<Vec<ConstructorStanding>, Error> {
    let url = format!("{JOLPICA_BASE}/{season}/{round}/constructorStandings.json");
    let response = reqwest::get(url)
        .await?
        .json::<JolpicaStandingsResponse>()
        .await?;

    let list = response
        .mr_data
        .standings_table
        .standings_lists
        .into_iter()
        .next()
        .and_then(|l| l.constructor_standings)
        .unwrap_or_default();

    let mapped = list
        .into_iter()
        .map(|item| ConstructorStanding {
            position: parse_u32(&item.position),
            points: parse_f64(&item.points),
            wins: parse_u32(&item.wins),
            constructor_id: item.constructor.constructor_id,
            name: item.constructor.name,
        })
        .collect::<Vec<_>>();

    Ok(mapped)
}

#[io_cached(
    map_error = r##"|e| anyhow::anyhow!(format!("disk cache error {:?}", e))"##,
    disk = true,
    time = 300
)]
async fn get_standings_cached(
    cache_key: String,
) -> Result<StandingsResponse, Error> {
    let mut parts = cache_key.splitn(2, ':');
    let season = parts.next().unwrap_or("current");
    let round = parts.next().unwrap_or("last");

    let (season_resolved, round_resolved, drivers) = fetch_driver_standings(&season, &round).await?;
    let constructors = fetch_constructor_standings(&season, &round).await?;

    Ok(StandingsResponse {
        season: season_resolved,
        round: round_resolved,
        drivers,
        constructors,
        source: "jolpica".to_string(),
    })
}

pub async fn get(
    Query(query): Query<StandingsQuery>,
) -> Result<axum::Json<StandingsResponse>, axum::http::StatusCode> {
    let season = query.season.unwrap_or_else(|| "current".to_string());
    let round = query.round.unwrap_or_else(|| "last".to_string());
    let cache_key = format!("{season}:{round}");

    match get_standings_cached(cache_key).await {
        Ok(result) => Ok(axum::Json(result)),
        Err(err) => {
            error!(?err, "failed to fetch standings");
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
