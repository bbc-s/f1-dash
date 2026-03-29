# Setup

A short tutorial on how to run f1-dash locally with Docker Desktop, Docker Compose and Portainer.

## What is included

- `compose.yaml`: local-only profile, binds all ports to `127.0.0.1`.
- `compose.lan.yaml`: optional LAN override (still local network, not public internet).
- `ops/start-local.ps1`: starts Docker (if needed), creates a backup, runs the stack.
- `ops/backup-state.ps1`: creates timestamped backups in `backups/runs/vX.Y.Z/...`.
- `ops/bump-version.ps1`: increments semantic patch version in `VERSION` and `dashboard/package.json`.
- `archive` service (source-build profile): live archive + replay clock API.

## Install prerequisites (Windows)

```powershell
winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
winget install -e --id GitHub.cli --accept-package-agreements --accept-source-agreements
```

After installation, start Docker Desktop once and wait until it shows **Running**.

## Configure environment

```powershell
Copy-Item compose.env.example compose.env
```

Optional: edit `compose.env` and set ports, image tag, or LAN IP.

## Run local-only (recommended)

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\start-local.ps1
```

Run local-only from your fork source code (build local images):

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\start-local.ps1 -BuildFromSource
```

When running source-build, replay/archive API is available at:`r`n- Archive/Replay API: `http://127.0.0.1:4020``r`n- Auto-record starts automatically on container start (`ARCHIVE_AUTO_RECORD=true`).`r`n- Host storage path is configurable with `ARCHIVE_STORAGE_PATH_HOST` in `compose.env`.

Access:
- Dashboard: `http://127.0.0.1:3000`
- Realtime API: `http://127.0.0.1:4000`
- API: `http://127.0.0.1:4010`
- Portainer: `http://127.0.0.1:9000`

## Run for local network (optional)

Set `LAN_BIND_IP` in `compose.env` to your PC's LAN IP (example `192.168.1.50`) and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\start-local.ps1 -LanMode
```

LAN mode from source build:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\start-local.ps1 -LanMode -BuildFromSource
```

This keeps access within your local network segment only. Do not forward router ports.

## Backups and versioning

- Every `ops/start-local.ps1` run triggers `ops/backup-state.ps1` first.
- Backups are timestamped and grouped by app version.
- To bump patch version:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\bump-version.ps1
```

## Stop stack

```powershell
docker compose --env-file compose.env -f compose.yaml down
```

If started in LAN mode:

```powershell
docker compose --env-file compose.env -f compose.yaml -f compose.lan.yaml down
```

If started with source-build:

```powershell
docker compose --env-file compose.env -f compose.yaml -f compose.local-build.yaml down
```

## Troubleshooting

If Docker CLI is installed but engine is unavailable, open Docker Desktop and wait for `Running`. On fresh systems, a reboot may be required after Docker Desktop install.

