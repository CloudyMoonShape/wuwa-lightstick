# Hardware and protocol

[简体中文](zh-CN/PROTOCOL.md) · [Hardware photos](HARDWARE.md) · [SDK](SDK.md) · [Function reference](FUNCTIONS.md)

These records describe one research sample. Device observations and static analysis have different evidence limits. Run commands from the repository root. Browser control does not require disassembly or a firmware backup.

## Hardware

| Part | Sample |
|---|---|
| Main board | `HE-750G24`; ST17H66B controller, identified with the PHY62x2 BLE family; 16 MHz crystal; PCB antenna |
| LED board | `HE-590L5`; one common-anode RGBW package; four low-side transistor switches, Q1–Q4 |
| Power | Three AAA cells, 4.5 V nominal; U2 supplies the controller |
| Serial pads | Four holes marked `P10P9`: `−`, `+`, `P10` (chip RX), `P9` (chip TX) |

## GATT connection

The sample advertises as `JFKJ-FBFB` while batteries are installed. The off state turns off the light but leaves Bluetooth available.

| Service | Characteristics |
|---|---|
| `180A` | Firmware version `V4.1.8` |
| `FA00` | `FA01`: read/notify; `FA02`: write |
| PhyPlus OTA `5833ff01` | `ff02`: write; `ff03`: notify |

Do not write to the OTA service. An unverified write can make the device unusable.

Initial tests on 2026-10-19 disconnected after about 8 seconds with status 19. Candidate color writes had no effect. The `FA02` description was the SDK template string `CharReadonly`. Analysis on 2026-10-22 identified the missing handshake:

1. Write ASCII `JFKJ-20250421` to `FA02` within 8 seconds of connection.
2. Subscribe to `FA01` and require an exact echo. The firmware then stops its disconnect timer.
3. Wait for the three blue flashes to finish before sending colors. The observed animation lasted about 0.9 seconds. The SDK waits 1.2 seconds; the Python tool waits 1.5 seconds.

The handshake is plaintext. It is not cryptographic authentication.

## GATT frames

Write one frame per `FA02` operation:

```text
command, parameters..., checksum
checksum = -sum(command and parameters) mod 256
```

The complete byte sum must be 0 modulo 256. Firmware drops frames with an invalid checksum. The notification path returns a reply on `FA01` after command processing. A reply is not an optical measurement.

Command `01` has six bytes:

```text
01 00 G R B checksum
```

The second byte is unused in the analyzed branch; the SDK sets it to zero. The wire order is **GRB**, although the SDK accepts RGB. Red and green output, and color retention after disconnect, were observed on 2026-10-22.

Equal, nonzero RGB selects the white channel. All-zero RGB turns the light off. In modes 2 and 4, a color write updates the effect's base color and can return prefix `a1`. It does not stop the effect.

The owner confirmed smooth single-color native breathing (`02`) on the sample. Other native commands have static-analysis and simulated-test evidence, but still need individual hardware tests. Command `03` starts a three-color fade; it is not a reset. See [native effects](NATIVE-EFFECTS.md) for command layouts, replies, and mode changes.

## Controller behavior

The controller provides native effects, browser-generated effects, and music response as three peer controls. The default is steady native output. `?engine=native` selects native breathing.

Native single-color effects need updates only when their base color or brightness changes. Fixed firmware palettes do not receive continuous color writes. Browser effects and music response calculate colors on the host. Mode changes use the stop command and a continuous-output path with white-channel protection.

Music input can come from a local file, shared Chrome tab audio, or a microphone. The browser analyzes the spectrum and detects beats with low-frequency spectral flux, an adaptive threshold, and a silence gate. Six music modes are implemented.

The synchronization control delays audio playback. Its estimate uses browser write duration, not measured optical latency. Adjust it by observation. A microphone hears sound that has already played; the controller cannot delay that original sound.

To run the controller locally:

```bash
npm run build
python3 -m http.server 8765 -d dist
```

Open `http://localhost:8765` in a compatible browser. The build inserts the shared header and footer.

`scripts/stick_ble.py` provides the handshake and color commands. `color R G B` takes RGB input and converts it to GRB.

## Venue broadcast research

The following parameters come from static analysis on 2026-10-22. They have **not** been verified with an RF transmitter or receiver.

Do not transmit these packets at an event. They can affect nearby lightsticks. Type 6 can write a group number to another device's flash. Power cycling does not undo that write. The repository only provides byte construction, not an RF transmitter.

The analyzed firmware has a raw RF task separate from the BLE stack. It starts reception about one second after power-on.

| Parameter | Static finding |
|---|---|
| Modulation | BLE Coded PHY, S=8; 125 kbps |
| Frequency | 2478 MHz; not one of the three BLE advertising channels |
| Access Address | `0x8E89BED6` |
| CRC | BLE CRC24; initial value `0x555555` |
| Whitening seed register | `0x38`; does not match the SDK's channel-derived formula. The actual LFSR initial state needs an RF test. |
| Packet | Two-byte header, six-byte AdvA, payload. Header byte 2 gives the following length. AdvA `11:11:11:11:11:11` is rejected. |

For payload `P[0..n-1]`, the last byte selects an XOR table entry. Decode `P[1..n-2]` with `table[P[n-1] & 0x3f]`. The 64-byte table is in `scripts/venue_packet.py`. After decoding, `P[n-2]` must equal the byte sum of `P[0..n-3]` modulo 256. The upper four bits of `P[0]` select the type.

| Type | Meaning |
|---|---|
| 1 | Three RGB bytes per group. Group `g` uses `P[3g-1..3g+1]`. |
| 2 | A 20-bit group mask: lower four bits of `P[2]`, then `P[3]` and `P[4]`. Group `g` uses bit `g-1`. The lower four bits of `P[5]` select the effect. |
| 3 | Brightness |
| 4 | Group `g` uses preset color number `P[g]`. |
| 6 | Write `P[5]`, from 1 to 20, to flash `0x3c000` as the device group. This is persistent. |

The reference backup stores group 2 at flash `0x3c000`. The receive path resets a 30-minute timer and locks the physical button after a valid packet. This is consistent with the observed button lock at a concert and later recovery. That observation alone does not verify the RF parameters.

Normal phone and desktop Bluetooth APIs do not expose the required raw radio controls. A separate radio implementation is required. The packet-generation script does not provide one.

## Research files

| Path | Purpose |
|---|---|
| `scripts/phy_read.py` | Read flash twice and compare hashes |
| `scripts/stick_ble.py` | GATT handshake and color control |
| `scripts/venue_packet.py` | Construct venue packet bytes; no transmission |
| `re/ghidra/` | Headless analysis scripts |
| `vendor/` | Local third-party tools; excluded from Git |
| `backup/` | Local firmware reads; excluded from Git |
| `.venv/` | Local Python environment; excluded from Git |

## Prepare the serial tools

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
mkdir -p vendor
curl -sSfL -o vendor/rdwr_phy62x2.py \
  https://raw.githubusercontent.com/pvvx/THB2/1454c2748f1fd5cff9f852173f25dc687aa292ba/rdwr_phy62x2.py
shasum -a 256 vendor/rdwr_phy62x2.py
```

Expected SHA-256: `1d23bc1cfa1cb82908626d4777923c2cca6a5d0230769f6e8a8681cee83395f5`.

## Back up firmware

This procedure is for developers who read their own device. The browser controller does not need it.

Historical notes contain two power arrangements: USB serial power at 3.3 V, and battery power with three signal wires. The reason for the change was not recorded. Neither arrangement was retested during this documentation audit. Check voltage levels and board connections before use. Select only one power source.

- **Battery power:** connect `− → GND`, `P10 → TX`, and `P9 → RX`. Leave serial `3V` and `+5V` disconnected. Disconnect and reconnect the batteries when a power cycle is required.
- **USB serial power:** remove all batteries first. Confirm a 3.3 V supply and sufficient current capacity. Use the connections below.

Do not connect batteries and serial `3V` at the same time. Never connect `+5V` to the board. Disconnect power before changing wires.

| Board | USB serial adapter |
|---|---|
| `+` | `3V`, only in USB-powered mode |
| `−` | `GND` |
| `P10` | `TX` |
| `P9` | `RX` |
| — | Leave `+5V` disconnected. |

Replace the serial device path with your adapter's path:

```bash
mkdir -p backup
.venv/bin/python -I scripts/phy_read.py /dev/cu.usbserial-0001
```

When prompted, power-cycle the device using the selected supply. The boot handshake window is about 10 seconds. The script retries for up to 10 minutes. If it does not connect, remove power and check the P9/P10 connections. Reconnect serial `3V` only in USB-powered mode. In battery-powered mode, reconnect the batteries.

### Reference backup record

The 2026-10-21 sample returned `Revision 001260c4 6222M005`, consistent with the PHY6222 identification. Flash capacity was 256 KB. The status register was `0x00`, with no factory write protection reported.

Two full reads differed at one word, offset `0x30100`. Fifty slow repeated reads with `--peek` produced changing values there, including `ffffe67d`, `ffffe67f`, and `ffff667d`. Nearby words remained stable.

The original notes suggested an unstable flash cell, possibly after interrupted programming. This is an inference, not a chip-level diagnosis. The analysis uses `read1` as its reference. The anomaly does not prove that all other backup bytes are correct.

| Read | SHA-256 |
|---|---|
| `read1` | `8be1f64cd4b084e213e353f449ced36b8dd835e3dbcf7e6e1628f48db281182c` |
| `read2` | `8a2391932a7b370f77b912cd671e9393ff0a16658c62054735d8d160d51d769f` |

The backups are not distributed. `phy_read.py --peek ADDR SIZE N` reads a region repeatedly and reports the observed values for each word.

`phy_read.py` removes the upstream `FlashUnlock` step, which would write zero to the flash status register. Here, *read-only* means no flash write; serial and peripheral registers are still initialized. If the device reports FCT mode, do not run the upstream `ea` command. That command erases the whole flash.
