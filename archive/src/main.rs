use std::{
    collections::HashSet,
    env,
    fs,
    io::Read,
    path::PathBuf,
    sync::Arc,
    time::Duration,
};

use anyhow::Error;
use axum::{
    Router,
    extract::{Json, State},
    http::{HeaderValue, Method, StatusCode},
    response::IntoResponse,
    routing::{get, post},
};
use base64::Engine as _;
use chrono::Utc;
use flate2::read::DeflateDecoder;
use futures::StreamExt;
use reqwest_eventsource::{Event, EventSource};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use tokio::{
    fs::{self as tokio_fs, OpenOptions},
    io::AsyncWriteExt,
    net::TcpListener,
    sync::Mutex,
};
use tower_http::cors::CorsLayer;
use tracing::{error, info, warn};

use shared::tracing_subscriber;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RecordedEvent {
    seq: u64,
    ts_ms: i64,
    event_type: String,
    payload: Value,
}

#[derive(Debug, Clone)]
struct ReplayEvent {
    rel_ms: i64,
    event_type: String,
    payload: Value,
}

#[derive(Debug)]
struct RecordingRuntime {
    recording_id: Option<String>,
    writer: Option<tokio_fs::File>,
    streams: Option<HashSet<String>>,
    seq: u64,
    started_at_ms: Option<i64>,
}

#[derive(Debug)]
struct ReplayRuntime {
    recording_id: Option<String>,
    events: Vec<ReplayEvent>,
    cursor_ms: i64,
    duration_ms: i64,
    speed: f64,
    playing: bool,
    last_tick_ms: i64,
    next_index: usize,
    state: Value,
    cars_data: Value,
    positions: Value,
}

#[derive(Debug)]
struct AppRuntime {
    storage_path: PathBuf,
    retention_days: u64,
    source_realtime_url: String,
    recording: RecordingRuntime,
    replay: ReplayRuntime,
}

#[derive(Clone)]
struct AppContext {
    runtime: Arc<Mutex<AppRuntime>>,
}

#[derive(Debug, Deserialize)]
struct StartRecordingRequest {
    name: Option<String>,
    streams: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct LoadReplayRequest {
    recording_id: String,
}

#[derive(Debug, Deserialize)]
struct SeekRequest {
    position_ms: i64,
}

#[derive(Debug, Deserialize)]
struct SpeedRequest {
    speed: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReplayFrameResponse {
    recording_id: Option<String>,
    playing: bool,
    speed: f64,
    cursor_ms: i64,
    duration_ms: i64,
    state: Value,
    cars_data: Value,
    positions: Value,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber();

    let addr = env::var("ADDRESS").unwrap_or_else(|_| "0.0.0.0:80".to_string());
    let storage_path = env::var("ARCHIVE_STORAGE_PATH").unwrap_or_else(|_| "/data/archive".to_string());
    let retention_days = env::var("ARCHIVE_RETENTION_DAYS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(14);
    let source_realtime_url =
        env::var("SOURCE_REALTIME_URL").unwrap_or_else(|_| "http://realtime:80".to_string());

    let runtime = AppRuntime {
        storage_path: PathBuf::from(storage_path),
        retention_days,
        source_realtime_url,
        recording: RecordingRuntime {
            recording_id: None,
            writer: None,
            streams: None,
            seq: 0,
            started_at_ms: None,
        },
        replay: ReplayRuntime {
            recording_id: None,
            events: Vec::new(),
            cursor_ms: 0,
            duration_ms: 0,
            speed: 1.0,
            playing: false,
            last_tick_ms: Utc::now().timestamp_millis(),
            next_index: 0,
            state: Value::Object(Map::new()),
            cars_data: Value::Null,
            positions: Value::Null,
        },
    };

    let runtime = Arc::new(Mutex::new(runtime));

    {
        let runtime = runtime.clone();
        tokio::spawn(async move {
            if let Err(err) = run_ingest_loop(runtime).await {
                error!(?err, "archive ingest loop failed");
            }
        });
    }

    {
        let runtime = runtime.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_hours(6)).await;
                if let Err(err) = cleanup_retention(runtime.clone()).await {
                    warn!(?err, "retention cleanup failed");
                }
            }
        });
    }

    let context = AppContext { runtime };
    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/archive/status", get(archive_status))
        .route("/api/archive/recordings", get(list_recordings))
        .route("/api/archive/start", post(start_recording))
        .route("/api/archive/stop", post(stop_recording))
        .route("/api/replay/load", post(load_replay))
        .route("/api/replay/play", post(replay_play))
        .route("/api/replay/pause", post(replay_pause))
        .route("/api/replay/seek", post(replay_seek))
        .route("/api/replay/speed", post(replay_speed))
        .route("/api/replay/state", get(replay_state))
        .route("/api/replay/frame", get(replay_frame))
        .with_state(context)
        .layer(cors_layer()?);

    info!(addr, "starting archive service");
    axum::serve(TcpListener::bind(addr).await?, app).await?;
    Ok(())
}

async fn health() -> impl IntoResponse {
    (StatusCode::OK, axum::Json(json!({ "service": true })))
}

fn merge(base: &mut Value, update: Value) {
    match (base, update) {
        (Value::Object(prev), Value::Object(update)) => {
            for (k, v) in update {
                merge(prev.entry(k).or_insert(Value::Null), v);
            }
        }
        (Value::Array(prev), Value::Object(update)) => {
            for (k, v) in update {
                if let Ok(index) = k.parse::<usize>() {
                    if let Some(item) = prev.get_mut(index) {
                        merge(item, v);
                    } else {
                        prev.push(v);
                    }
                }
            }
        }
        (a, b) => *a = b,
    }
}

fn filter_payload(payload: Value, streams: Option<&HashSet<String>>) -> Value {
    let Some(streams) = streams else {
        return payload;
    };

    if streams.is_empty() {
        return payload;
    }

    match payload {
        Value::Object(obj) => {
            let filtered = obj
                .into_iter()
                .filter(|(key, _)| streams.contains(key))
                .collect::<Map<String, Value>>();
            Value::Object(filtered)
        }
        _ => payload,
    }
}

fn decode_deflate_json(raw: &str) -> Option<Value> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(raw).ok()?;
    let mut decoder = DeflateDecoder::new(&bytes[..]);
    let mut output = String::new();
    decoder.read_to_string(&mut output).ok()?;
    serde_json::from_str::<Value>(&output).ok()
}

fn update_cars_and_positions(replay: &mut ReplayRuntime, payload: &Value) {
    let car_data = payload
        .get("CarDataZ")
        .or_else(|| payload.get("CarData.z"))
        .and_then(Value::as_str)
        .and_then(decode_deflate_json);

    if let Some(car_data) = car_data {
        if let Some(entries) = car_data.get("Entries").and_then(Value::as_array) {
            if let Some(last) = entries.last() {
                if let Some(cars) = last.get("Cars") {
                    replay.cars_data = cars.clone();
                }
            }
        }
    }

    let position = payload
        .get("PositionZ")
        .or_else(|| payload.get("Position.z"))
        .and_then(Value::as_str)
        .and_then(decode_deflate_json);

    if let Some(position) = position {
        if let Some(items) = position.get("Position").and_then(Value::as_array) {
            if let Some(last) = items.last() {
                if let Some(entries) = last.get("Entries") {
                    replay.positions = entries.clone();
                }
            }
        }
    }
}

fn apply_event(replay: &mut ReplayRuntime, event: &ReplayEvent) {
    match event.event_type.as_str() {
        "initial" => {
            replay.state = event.payload.clone();
            update_cars_and_positions(replay, &event.payload);
        }
        "update" => {
            merge(&mut replay.state, event.payload.clone());
            update_cars_and_positions(replay, &event.payload);
        }
        _ => {}
    }
}

fn rebuild_to_cursor(replay: &mut ReplayRuntime) {
    replay.state = Value::Object(Map::new());
    replay.cars_data = Value::Null;
    replay.positions = Value::Null;
    replay.next_index = 0;

    while replay.next_index < replay.events.len()
        && replay.events[replay.next_index].rel_ms <= replay.cursor_ms
    {
        let idx = replay.next_index;
        let event = replay.events[idx].clone();
        apply_event(replay, &event);
        replay.next_index += 1;
    }
}

fn tick_replay(replay: &mut ReplayRuntime) {
    let now = Utc::now().timestamp_millis();

    if replay.playing {
        let elapsed = now - replay.last_tick_ms;
        let delta = (elapsed as f64 * replay.speed) as i64;
        replay.cursor_ms = (replay.cursor_ms + delta).clamp(0, replay.duration_ms);
    }

    replay.last_tick_ms = now;

    while replay.next_index < replay.events.len()
        && replay.events[replay.next_index].rel_ms <= replay.cursor_ms
    {
        let idx = replay.next_index;
        let event = replay.events[idx].clone();
        apply_event(replay, &event);
        replay.next_index += 1;
    }
}

async fn run_ingest_loop(runtime: Arc<Mutex<AppRuntime>>) -> Result<(), Error> {
    loop {
        let url = {
            let state = runtime.lock().await;
            format!("{}/api/realtime", state.source_realtime_url.trim_end_matches('/'))
        };

        info!(url, "connecting archive ingest to realtime");

        let client = reqwest::Client::new();
        let request = client.get(url);
        let mut source = EventSource::new(request)?;

        while let Some(event) = source.next().await {
            match event {
                Ok(Event::Open) => {}
                Ok(Event::Message(message)) => {
                    if message.event != "initial" && message.event != "update" {
                        continue;
                    }

                    let payload = match serde_json::from_str::<Value>(&message.data) {
                        Ok(payload) => payload,
                        Err(err) => {
                            warn!(?err, "failed to parse realtime payload");
                            continue;
                        }
                    };

                    let mut state = runtime.lock().await;
                    if state.recording.writer.is_none() {
                        continue;
                    }

                    let filtered =
                        filter_payload(payload, state.recording.streams.as_ref());
                    let event = RecordedEvent {
                        seq: state.recording.seq,
                        ts_ms: Utc::now().timestamp_millis(),
                        event_type: message.event.clone(),
                        payload: filtered,
                    };
                    state.recording.seq += 1;

                    if let Some(writer) = state.recording.writer.as_mut() {
                        let line = serde_json::to_string(&event)?;
                        writer.write_all(line.as_bytes()).await?;
                        writer.write_all(b"\n").await?;
                        writer.flush().await?;
                    }
                }
                Err(err) => {
                    warn!(?err, "archive ingest stream error, reconnecting");
                    break;
                }
            }
        }

        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

async fn archive_status(State(ctx): State<AppContext>) -> impl IntoResponse {
    let state = ctx.runtime.lock().await;
    (
        StatusCode::OK,
        axum::Json(json!({
            "recording": state.recording.writer.is_some(),
            "recordingId": state.recording.recording_id,
            "replayRecordingId": state.replay.recording_id,
            "replayPlaying": state.replay.playing,
            "replayCursorMs": state.replay.cursor_ms,
            "replayDurationMs": state.replay.duration_ms,
            "storagePath": state.storage_path,
        })),
    )
}

async fn list_recordings(State(ctx): State<AppContext>) -> impl IntoResponse {
    let storage_path = {
        let state = ctx.runtime.lock().await;
        state.storage_path.clone()
    };

    let mut recordings = Vec::new();
    if let Ok(mut dir) = tokio_fs::read_dir(storage_path).await {
        while let Ok(Some(entry)) = dir.next_entry().await {
            if let Ok(file_type) = entry.file_type().await {
                if file_type.is_dir() {
                    recordings.push(entry.file_name().to_string_lossy().to_string());
                }
            }
        }
    }
    recordings.sort_unstable();

    (StatusCode::OK, axum::Json(json!({ "recordings": recordings })))
}

async fn start_recording(
    State(ctx): State<AppContext>,
    Json(request): Json<StartRecordingRequest>,
) -> impl IntoResponse {
    let (recording_id, storage_path, retention_days) = {
        let state = ctx.runtime.lock().await;
        if state.recording.writer.is_some() {
            return (
                StatusCode::CONFLICT,
                axum::Json(json!({ "error": "recording already active" })),
            )
                .into_response();
        }
        (
            request
                .name
                .unwrap_or_else(|| format!("rec-{}", Utc::now().format("%Y%m%d-%H%M%S"))),
            state.storage_path.clone(),
            state.retention_days,
        )
    };

    let recording_dir = storage_path.join(&recording_id);
    if let Err(err) = tokio_fs::create_dir_all(&recording_dir).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(json!({ "error": err.to_string() })),
        )
            .into_response();
    }

    let event_path = recording_dir.join("events.ndjson");
    let file = match OpenOptions::new()
        .create(true)
        .append(true)
        .open(event_path)
        .await
    {
        Ok(file) => file,
        Err(err) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                axum::Json(json!({ "error": err.to_string() })),
            )
                .into_response();
        }
    };

    let metadata_path = recording_dir.join("metadata.json");
    let started_at_ms = Utc::now().timestamp_millis();
    let metadata = json!({
        "recordingId": recording_id,
        "startedAtMs": started_at_ms,
        "streams": request.streams.clone().unwrap_or_default()
    });
    let _ = tokio_fs::write(metadata_path, serde_json::to_vec_pretty(&metadata).unwrap_or_default()).await;

    {
        let mut state = ctx.runtime.lock().await;
        state.recording.recording_id = Some(recording_id.clone());
        state.recording.writer = Some(file);
        state.recording.seq = 0;
        state.recording.started_at_ms = Some(started_at_ms);
        state.recording.streams = request
            .streams
            .map(|items| items.into_iter().collect::<HashSet<String>>());
    }

    if let Err(err) = cleanup_storage_path(storage_path, retention_days).await {
        warn!(?err, "retention cleanup failed after start");
    }

    (
        StatusCode::OK,
        axum::Json(json!({ "recordingId": recording_id })),
    )
        .into_response()
}

async fn stop_recording(State(ctx): State<AppContext>) -> impl IntoResponse {
    let mut state = ctx.runtime.lock().await;
    let Some(recording_id) = state.recording.recording_id.clone() else {
        return (
            StatusCode::BAD_REQUEST,
            axum::Json(json!({ "error": "recording is not active" })),
        )
            .into_response();
    };

    state.recording.writer = None;
    state.recording.streams = None;
    state.recording.recording_id = None;
    state.recording.seq = 0;

    let metadata_path = state.storage_path.join(&recording_id).join("metadata.json");
    let ended = json!({
        "recordingId": recording_id,
        "endedAtMs": Utc::now().timestamp_millis(),
    });
    let _ = tokio_fs::write(metadata_path, serde_json::to_vec_pretty(&ended).unwrap_or_default()).await;

    (
        StatusCode::OK,
        axum::Json(json!({ "stopped": true })),
    )
        .into_response()
}

async fn load_replay(
    State(ctx): State<AppContext>,
    Json(request): Json<LoadReplayRequest>,
) -> impl IntoResponse {
    let (storage_path, recording_id) = {
        let state = ctx.runtime.lock().await;
        (state.storage_path.clone(), request.recording_id.clone())
    };

    let path = storage_path.join(&recording_id).join("events.ndjson");
    let content = match tokio_fs::read_to_string(path).await {
        Ok(content) => content,
        Err(err) => {
            return (
                StatusCode::NOT_FOUND,
                axum::Json(json!({ "error": format!("recording not found: {}", err) })),
            )
                .into_response();
        }
    };

    let mut raw_events = Vec::<RecordedEvent>::new();
    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(parsed) = serde_json::from_str::<RecordedEvent>(line) {
            raw_events.push(parsed);
        }
    }

    if raw_events.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            axum::Json(json!({ "error": "recording has no events" })),
        )
            .into_response();
    }

    raw_events.sort_by_key(|e| e.ts_ms);
    let base_ts = raw_events.first().map(|e| e.ts_ms).unwrap_or(0);

    let events = raw_events
        .into_iter()
        .map(|event| ReplayEvent {
            rel_ms: event.ts_ms - base_ts,
            event_type: event.event_type,
            payload: event.payload,
        })
        .collect::<Vec<_>>();

    let duration_ms = events.last().map(|e| e.rel_ms).unwrap_or(0);

    let mut state = ctx.runtime.lock().await;
    state.replay.recording_id = Some(recording_id);
    state.replay.events = events;
    state.replay.cursor_ms = 0;
    state.replay.duration_ms = duration_ms;
    state.replay.speed = 1.0;
    state.replay.playing = false;
    state.replay.last_tick_ms = Utc::now().timestamp_millis();
    state.replay.next_index = 0;
    state.replay.state = Value::Object(Map::new());
    state.replay.cars_data = Value::Null;
    state.replay.positions = Value::Null;
    rebuild_to_cursor(&mut state.replay);

    (
        StatusCode::OK,
        axum::Json(json!({ "loaded": true, "durationMs": duration_ms })),
    )
        .into_response()
}

async fn replay_play(State(ctx): State<AppContext>) -> impl IntoResponse {
    let mut state = ctx.runtime.lock().await;
    state.replay.playing = true;
    state.replay.last_tick_ms = Utc::now().timestamp_millis();
    (StatusCode::OK, axum::Json(json!({ "playing": true })))
}

async fn replay_pause(State(ctx): State<AppContext>) -> impl IntoResponse {
    let mut state = ctx.runtime.lock().await;
    tick_replay(&mut state.replay);
    state.replay.playing = false;
    (StatusCode::OK, axum::Json(json!({ "playing": false })))
}

async fn replay_seek(
    State(ctx): State<AppContext>,
    Json(request): Json<SeekRequest>,
) -> impl IntoResponse {
    let mut state = ctx.runtime.lock().await;
    let clamped = request.position_ms.clamp(0, state.replay.duration_ms);
    state.replay.cursor_ms = clamped;
    state.replay.last_tick_ms = Utc::now().timestamp_millis();
    rebuild_to_cursor(&mut state.replay);
    (
        StatusCode::OK,
        axum::Json(json!({ "cursorMs": state.replay.cursor_ms })),
    )
}

async fn replay_speed(
    State(ctx): State<AppContext>,
    Json(request): Json<SpeedRequest>,
) -> impl IntoResponse {
    let mut state = ctx.runtime.lock().await;
    state.replay.speed = request.speed.clamp(0.1, 8.0);
    (
        StatusCode::OK,
        axum::Json(json!({ "speed": state.replay.speed })),
    )
}

async fn replay_state(State(ctx): State<AppContext>) -> impl IntoResponse {
    let mut state = ctx.runtime.lock().await;
    tick_replay(&mut state.replay);
    (
        StatusCode::OK,
        axum::Json(json!({
            "recordingId": state.replay.recording_id,
            "playing": state.replay.playing,
            "speed": state.replay.speed,
            "cursorMs": state.replay.cursor_ms,
            "durationMs": state.replay.duration_ms
        })),
    )
}

async fn replay_frame(State(ctx): State<AppContext>) -> impl IntoResponse {
    let mut state = ctx.runtime.lock().await;
    tick_replay(&mut state.replay);

    let response = ReplayFrameResponse {
        recording_id: state.replay.recording_id.clone(),
        playing: state.replay.playing,
        speed: state.replay.speed,
        cursor_ms: state.replay.cursor_ms,
        duration_ms: state.replay.duration_ms,
        state: state.replay.state.clone(),
        cars_data: state.replay.cars_data.clone(),
        positions: state.replay.positions.clone(),
    };

    (StatusCode::OK, axum::Json(response))
}

async fn cleanup_retention(runtime: Arc<Mutex<AppRuntime>>) -> Result<(), Error> {
    let (storage_path, retention_days) = {
        let state = runtime.lock().await;
        (state.storage_path.clone(), state.retention_days)
    };
    cleanup_storage_path(storage_path, retention_days).await
}

async fn cleanup_storage_path(storage_path: PathBuf, retention_days: u64) -> Result<(), Error> {
    let now = Utc::now().timestamp_millis();
    let cutoff_ms = now - (retention_days as i64 * 24 * 60 * 60 * 1000);

    tokio::task::spawn_blocking(move || -> Result<(), Error> {
        if !storage_path.exists() {
            return Ok(());
        }

        for entry in fs::read_dir(&storage_path)? {
            let entry = entry?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let metadata = fs::metadata(&path)?;
            let modified = metadata.modified()?;
            let modified_ms = chrono::DateTime::<Utc>::from(modified).timestamp_millis();
            if modified_ms < cutoff_ms {
                let _ = fs::remove_dir_all(&path);
            }
        }

        Ok(())
    })
    .await??;

    Ok(())
}

fn cors_layer() -> Result<CorsLayer, Error> {
    let origin = env::var("ORIGIN").unwrap_or_else(|_| "http://127.0.0.1:3000".to_string());

    let origins = origin
        .split(';')
        .filter_map(|o| HeaderValue::from_str(o).ok())
        .collect::<Vec<HeaderValue>>();

    Ok(CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS]))
}
