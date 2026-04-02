<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./dashboard/public/tag-logo.png" width="200">
    <img alt="f1-dash" src="./dashboard/public/tag-logo.png" width="200">
  </picture>
</p>

<h1 align="center">Real-time Formula 1 telemetry and timing</h1>

## f1-dash

A real-time F1 dashboard that shows the leader board, tires, gaps, laps, mini sectors and much more.

## Local Docker Run

Use Docker Desktop + Compose + Portainer with localhost-only defaults:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\start-local.ps1
```

The stack stays private to your machine by default (`127.0.0.1` bindings).

Run from local fork source code (build local images):

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\start-local.ps1 -BuildFromSource
```

If UI changes do not show after pull/build, run hard redeploy:

```powershell
powershell -ExecutionPolicy Bypass -File .\ops\redeploy-local.ps1
```

Full guide: [SETUP.md](SETUP.md)

## Dashboard UX Notes

- `Telemetry (Large)` supports team-tinted cards and optional transparent mode (Settings -> Visual).
- Widget headers can be shown only on hover as overlay (Settings -> Visual), so layout does not jump.
- Layout lock is available from sidebar and from the top dashboard bar (when sidebar is collapsed).
- Replay stop now pauses and keeps last rendered widget state instead of forcing seek to 0.

## Contributing

I really appreciate your interest in contributing to this project. I recommend checking out the GitHub issues marked as "Good First Issue" to get started. Also, please read [`CONTRIBUTING.md`](CONTRIBUTING.md) to learn how to contribute and set up f1-dash on your local machine for development.

## Supporting

If you'd like to support this project and help me dedicate more time to it, you can [buy me a coffee](https://www.buymeacoffee.com/slowlydev).

## Notice

This project/website is unofficial and is not associated in any way with the Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trade marks of Formula One Licensing B.V.
