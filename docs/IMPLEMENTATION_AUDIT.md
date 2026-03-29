# F1 Dash Fork Audit and Implementation Notes

## 1) Audit existing state

- `realtime` service already keeps a single upstream SignalR ingestion loop and broadcasts to all HTTP SSE clients.
- Frontend originally opened one SSE connection per browser window (`useSocket`), causing duplicated downstream connections from browser to backend.
- Schedule data originally relied on a single external ICS source in `api/src/endpoints/schedule.rs`. This is brittle and was the main reason local `/schedule` failed intermittently.
- Docker compose originally set dashboard `API_URL=http://localhost:4010` (and later `127.0.0.1`). Inside container, that points to itself, not the `api` service.
- Standings page originally depended only on `ChampionshipPrediction` live topic, which is race-context dependent and can appear unavailable.
- Weather numerical values are available from F1 `WeatherData`; radar comes from RainViewer.
- Car telemetry feed currently exposes channels `0,2,3,4,5,45` (rpm, speed, gear, throttle, brake, drs). No reliable ERS/overtake/boost channels are present in current source usage.

## 2) Architecture changes

- Replaced schedule provider with Jolpica-compatible API in backend:
  - `/api/schedule`
  - `/api/schedule/next`
- Added new backend standings endpoint:
  - `/api/standings?season=current&round=last`
- Introduced frontend multi-window live sync with leader election:
  - One leader tab keeps SSE connection.
  - Other tabs receive updates via `BroadcastChannel`.
  - Fallback re-election on stale leader heartbeat.
- Introduced widget architecture:
  - Widget registry and per-widget persisted layout config (order, visible, zoom, size).
  - Drag reorder, browser-native resize, hide/show, popout per widget.
  - Real-time widget layout sync across windows via `BroadcastChannel`.
- Introduced telemetry large widget and tyre status widget.

## 3) Implementation plan status

- Completed:
  - Schedule backend refactor to Jolpica.
  - Standings backend endpoint.
  - Standings frontend with official+simulated split and editable deltas.
  - Widget board with persisted per-user layout and popout windows.
  - Leader/follower socket architecture with broadcast sync.
  - Local docker compose API URL fix for container networking.
  - Weather source labels.
- In progress / next:
  - Dedicated replay archival service/container with append-only log and replay control endpoints.
  - Full replay UI (play/pause/seek/speed) powered by single replay clock for all widgets.
  - Additional tests for frontend widget sync and column config behavior.

## 4) Data-source limitations (explicit)

- Not implemented as live metrics due unavailable/unsafe source mapping:
  - overtake mode
  - straight mode
  - boost
  - battery deploy / ERS deploy
- Reason:
  - Current feed integration in this project only consumes known channels with verified mapping:
    - `0` rpm
    - `2` speed
    - `3` gear
    - `4` throttle
    - `5` brake
    - `45` drs
- Remaining tyre sets:
  - Current feed provides stint usage (`TimingAppData.Stints`), not full official allocation ledger.
  - UI therefore distinguishes availability and marks remaining-set count as `not provided`.

## 5) Compatibility and performance notes

- Backward compatibility:
  - Existing dashboard routes remain available.
  - Settings persistence remains in local storage; extended with widget and leaderboard-column config.
- Performance:
  - Primary upstream feed remains single in backend.
  - Browser-side now prefers one SSE tab leader + inter-window sync.
  - Reduces duplicated SSE traffic and event decoding across multiple windows.
