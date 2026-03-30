# F1 Dash AI Bootstrap (One-Click Run Guide)

This file is for AI agents (Codex/CLI agents) to reliably bring `f1-dash` up on a fresh machine with minimal user interaction.

## Repository Facts

- Main runtime uses Docker Compose.
- Local web URL: `http://127.0.0.1:3000`
- Services:
  - `web` (Next.js frontend)
  - `api` (Rust backend)
  - `realtime` (Rust live stream bridge)
  - `archive` (Rust replay/recording service)
  - `portainer` (optional UI)

## Required Tools

- Git
- Docker Desktop (or Docker Engine + Compose plugin)
- Node.js (only needed for local lint/tests outside Docker)

## Windows Install (if missing)

```powershell
winget install -e --id Git.Git
winget install -e --id Docker.DockerDesktop
winget install -e --id OpenJS.NodeJS.LTS
```

After Docker install, ensure Docker Desktop is running.

## Clone + Start

```powershell
git clone https://github.com/bbc-s/f1-dash.git
cd f1-dash
```

Create env file (if missing):

```powershell
if (!(Test-Path .\compose.env)) { Copy-Item .\compose.env.example .\compose.env }
```

Recommended local-only settings in `compose.env`:

- `WEB_PORT=3000`
- `REALTIME_PORT=4000`
- `API_PORT=4010`
- `ARCHIVE_PORT=4020`
- `PORTAINER_PORT=9000`
- `ARCHIVE_STORAGE_PATH_HOST=./data/archive`
- `ARCHIVE_AUTO_RECORD=false` (manual by default, can be toggled from UI/API)

Run stack:

```powershell
docker compose --env-file compose.env -f compose.yaml -f compose.local-build.yaml up -d --build
```

## Health Checks

```powershell
docker compose --env-file compose.env -f compose.yaml -f compose.local-build.yaml ps
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000 | Select-Object -ExpandProperty StatusCode
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4020/api/archive/status | Select-Object -ExpandProperty Content
```

Expected: HTTP 200, all services `Up`.

## Useful Commands

Rebuild/restart:

```powershell
docker compose --env-file compose.env -f compose.yaml -f compose.local-build.yaml up -d --build
```

Stop:

```powershell
docker compose --env-file compose.env -f compose.yaml -f compose.local-build.yaml down
```

Logs:

```powershell
docker compose --env-file compose.env -f compose.yaml -f compose.local-build.yaml logs -f web api realtime archive
```

## Replay/Archive API Quick Use

- Status: `GET /api/archive/status`
- List: `GET /api/archive/recordings`
- Start rec: `POST /api/archive/start`
- Stop rec: `POST /api/archive/stop`
- Toggle auto-on-data: `POST /api/archive/auto` with body `{"enabled":true|false}`
- Delete rec: `POST /api/archive/recordings/{id}/delete`
- Rename rec: `POST /api/archive/recordings/{id}/rename` with body `{"name":"New Name"}`
- Load replay: `POST /api/replay/load` with body `{"recording_id":"..."}` then `POST /api/replay/play`

## AI Execution Policy

When user asks to "make it run":

1. Verify Docker is available (`docker --version`, `docker compose version`).
2. Ensure `compose.env` exists and has local-only ports/binds.
3. Run compose `up -d --build`.
4. Verify service health.
5. Report URLs and active containers.

When user asks to "update code":

1. Apply changes.
2. Run frontend lint (`dashboard`: `npm run lint`) if needed.
3. Rebuild stack via compose.
4. Verify endpoints/UI.
5. Bump version files (`VERSION`, `dashboard/package.json`, compose image tags/env sample) before commit.
