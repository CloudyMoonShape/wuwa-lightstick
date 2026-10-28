# Development guide

## Technology stack

| Component | Technology | Responsibility |
| --- | --- | --- |
| Mac collector | Python standard library, SQLite, macOS kqueue | Detect new and removed notification records without reading message content |
| Transport | OpenSSH over Tailscale | Send source keys to the controller through an authenticated private connection |
| Controller | Python asyncio, Unix socket | Serialize effects, interrupt old effects, enforce time and presence rules |
| BLE transport | Bleak and Linux BlueZ | Authenticate once, write GATT commands, keep the connection open |
| Device effects | Existing lightstick firmware | Generate smooth native breathing |
| Configuration | Local JSON file | Keep machine identity, network details, and device addresses out of source control |

No cloud account, web server, message broker, or paid API is required. This implementation uses macOS-specific kqueue; the collector is not cross-platform. Run a current Python 3 version with `zoneinfo` support; the tested deployment used Python 3.15 on macOS.

## Modules

- `config.py`: load local configuration and create the state directory.
- `collector.py`: watch database/WAL replacement, read metadata, group source records, and forward events. A 30-second fallback check covers missed file events. While active, child-process checks run at one-second intervals.
- `trial.py`: source color constants and eligibility checks. The historical filename does not imply that it should be run as a standalone controller.
- `daemon.py`: native breathing, direct-color transition, time-based fades, preemption, and shutdown cleanup.
- `send.py`: a small client for the local controller socket.

The collector starts from the current maximum record ID. This prevents historical replay. It ignores changes to existing rows that do not create a new ID; applications that update a notification in place may need an adapter. Record deletion is a heuristic for dismissal. Database rotation resets the baseline.

## Change an application or color

Add the actual application bundle identifier to `APPS` in `collector.py`. Map it to a fixed source key, then add that key to `COLORS` in `trial.py`. Use a real delivered notification to verify the identifier. Never match on message content unless a new feature explicitly requires it and its privacy behavior is documented.

RGB values are device command values, not calibrated colorimetry. Byte order on the wire is GRB. Equal nonzero RGB invokes the W channel. Command 0e does not preserve dim white, so neutral white uses 01. Tinted colors must not round into equal nonzero RGB during fading. See the main SDK and native-effects documentation before changing packet construction.

## Change timing and policy

The controller currently breathes for 5.5 seconds and fades for 120 seconds. A local `breath-seconds` file in the controller state directory overrides breathing duration, clamped to 1–10 seconds. Dismissal uses a two-second fade. Edit these values in `daemon.py`; do not confuse the fixed native breath period with a programmable firmware animation queue.

`allowed()` always checks local time, and caches network presence for 1800 seconds. A local `quiet-override-until` state file may contain a Unix expiry timestamp for a temporary quiet-hours override. It does not bypass presence. Never commit this runtime file. Home-subnet matching is a convenience heuristic: a different network with the same subnet can produce a false positive.

## Tests

Run `python3 -m unittest discover -s tools/notification-bridge/tests` from the repository root. Tests use fake BLE writes; they do not illuminate a device. Run `npm test` and `npm run build` for repository regression checks.

For hardware acceptance, verify each source, rapid cross-source notifications, duplicate notifications, clear events during breathing and fading, white transitions, disconnect/reconnect, midnight, presence-cache expiry, and shutdown. Record command success separately from what the light actually did. Do not send malformed or oversized frames to discover features: no script-upload interface has been established.

## Operational boundaries

Use one BLE owner. The browser controller can compete with this process. Service restarts can disconnect BLE; the next alert may authenticate again. Do not reset the system Bluetooth adapter to recover one device. Do not expose the Unix socket through an unauthenticated public service.

Keep local configs, logs, host aliases, IP/MAC addresses, notification metadata, firmware dumps, and generated decompilation outside commits. The example config contains placeholders. Preserve the repository license when redistributing changes.
