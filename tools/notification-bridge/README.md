# Notification bridge

[中文](README.zh-CN.md) · [日本語](README.ja.md) · [Development guide](DEVELOPMENT.md)

Use macOS notifications to control a nearby lightstick through a private Tailscale network. This optional tool does not change the web controller.

```text
Mac notification database → collector → SSH → Linux controller → BLE → lightstick
```

The collector reads application identifiers, record IDs, and delivery times. It does not select notification titles or bodies. macOS database access requires Full Disk Access for the Python process that runs the collector. The database format is an undocumented system detail and can change.

## Behavior

| Application | Color |
| --- | --- |
| Claude Desktop | Orange |
| ChatGPT / Codex | White |
| WeChat | Green |
| Lark | Sky blue |
| Muse | Purple |
| Telegram | Pink |

- Run native breathing for 5.5 seconds, then fade from 30% of the configured color to zero over 120 seconds. There is no holding period.
- A different source interrupts the current effect. Repeated notifications from the same source are grouped.
- When all tracked records disappear, fade out over two seconds. Disappearance can mean dismissal, application withdrawal, or system cleanup; it is not proof of reading.
- Permit alerts from 08:00 until midnight in the configured timezone. Require a direct Tailscale endpoint in the configured home subnet. Cache presence for 30 minutes, including failures. This indicates the source computer's network, not a person's location.
- Keep BLE connected between alerts. Reconnection can cause the firmware's blue authentication flashes.
- Do not replay records present at collector startup or records older than 30 seconds.

## Setup

1. Use a Mac as the collector and a Linux host with BlueZ and a BLE adapter near the lightstick. Install Tailscale and configure key-based SSH from the Mac to that host.
2. Copy this directory to both hosts. On Linux, create a virtual environment and install `requirements.txt`. The Mac collector uses only Python's standard library.
3. Copy `config.example.json` to `~/.config/resonator-notify/config.json` on both hosts. Replace every example value. Use absolute remote paths. Keep the populated file private. `RESONATOR_CONFIG` can select a different path.
4. On Linux, run `venv/bin/python daemon.py`. On the Mac, first run `python3 collector.py --seconds 60` for observation only. Grant Full Disk Access if its status file reports a database access error.
5. Run `python3 collector.py --seconds 0 --send` to enable forwarding. Zero means run until stopped. Only one controller and one collector should run per installation.

The controller creates a local Unix socket in its state directory. No public HTTP endpoint is opened. Inspect `collector-status.json` in the Mac state directory for health. Restrict SSH access to trusted users; they can request effects and affect the local state files.

On Linux, `venv/bin/python send.py status` reports connection state. Use `send.py gpt`, `send.py lark`, or another source key for a manual demo. `send.py clear:gpt` requests a quick fade only if that source is active. Manual demos bypass notification detection, but still enforce time and home-network checks.

On the Mac, double-click a source script in `demo/`, or run `python3 demo.py telegram`. These demos use the local SSH configuration and do not create synthetic macOS notifications.

Use a macOS LaunchAgent for the collector and a Linux user systemd service for the controller. Set absolute paths, capture stderr, and use a restart delay. Full Disk Access must apply to the background interpreter, not only an interactive terminal. No service is installed automatically by this repository.

## Limits

The native breath period is fixed; 5.5 seconds is a device-trial duration, not an exact firmware repeat counter. Host-driven fades have visible brightness steps. White requires a different command path and can flash during mode transitions. Early dismissal during native breathing estimates brightness because firmware exposes no live brightness query. Presence can remain stale for 30 minutes. If a controller disconnects or crashes, a final off command is best effort. Do not depend on the lightstick for critical alerts.

The event-driven collector measured below 0.1% idle CPU in a short local trial; this is not a universal performance guarantee. Test notifications, dismissal, sleep/wake, network changes, and restart on your own installation.

This code remains under the repository's [source-available license](../../LICENSE). Free use, modification and sharing are subject to that license; commercial restrictions remain. This is not an unrestricted open-source license.
