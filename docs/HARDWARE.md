# Hardware

[中文](zh-CN/HARDWARE.md) · [Protocol](PROTOCOL.md) · [SDK](SDK.md)

These photographs show the research sample. The copies retain the full frame and orientation. They were resized and converted, and EXIF/GPS metadata was removed. No device details were generated or repainted.

| HE-590L5 LED board | HE-750G24 controller board |
|---|---|
| [![LED board with B, W, R, and positive markings around a composite LED package](../web/assets/hardware/led-module.webp)](../web/assets/hardware/led-module.webp) | [![Controller board with ST17H66B, button, 16.000 MHz crystal, and P10P9 port](../web/assets/hardware/board-front.webp)](../web/assets/hardware/board-front.webp) |

| Controller rear | Assembly |
|---|---|
| [![Board rear with traces, vias, LED connections, and negative marking](../web/assets/hardware/board-back.webp)](../web/assets/hardware/board-back.webp) | [![Disassembled lightstick with controller, battery holder, shell, and optical parts](../web/assets/hardware/assembly.webp)](../web/assets/hardware/assembly.webp) |

## Identify the sample

| Part | Visible evidence | Limit |
|---|---|---|
| LED board | `HE-590L5`; `B`, `W`, `R`, and `+`; a phosphor region and multiple die regions. | Consistent with the RGBW research record. The photograph does not establish every connection. |
| Controller front | `HE-750G24`; `ST17H66B` on U1; `16.000 MHz`; button; four-hole `P10P9` port. | Matches the studied board. Read the firmware version from the device. Appearance cannot establish it. |
| Controller rear | Traces, vias, mounting holes, and power contacts. | Useful for locating parts. No continuity test or full GPIO map is established by the image. |
| Assembly | LED and optical-part positions, board mounting, shell, and battery holder. | Shows the arrangement. It is not a complete disassembly guide. |

Photographs establish appearance. Check electrical connections and signal meanings separately. [Protocol](PROTOCOL.md) and [Functions](FUNCTIONS.md) distinguish hardware observations from static analysis.

## RGBW behavior

The LED package has red, green, blue, and separate white channels. The W marking and phosphor region help identify the structure. The following rules come from firmware analysis and device records, not from the photographs:

- A GATT color frame contains three color bytes. For `R = G = B > 0`, the firmware selects W. All-zero RGB turns the light off.
- Equal RGB values therefore do not mean that the three colored channels mix white. The browser uses this behavior for white and gray. It prevents rounding from selecting W for other colors.
- Independent, simultaneous control of RGB and W through this interface has not been established. The SDK does not expose an unverified four-channel function.

White and mixed RGB use different output paths. A photograph cannot measure channel brightness, spectrum, or color accuracy. It also cannot prove that a color error comes from firmware. See [Color mixing](COLOR-MIXING.md).

## Continue the research

1. Compare board markings and layout. Read the firmware version. Current records describe `HE-750G24`, `HE-590L5`, and firmware `V4.1.8`. Similar appearance does not guarantee protocol compatibility.
2. Connect to your device with an [SDK example](SDK.md). Record input bytes, replies, and visible output. The SDK accepts raw RGB; the browser map is a separate stage.
3. Use the [function map](FUNCTIONS.md) to locate internal behavior. Follow [reverse-engineering setup](../re/README.md) with your own firmware.
4. Use the serial port only if firmware research requires it. Follow the mutually exclusive power options in [Protocol](PROTOCOL.md). The photographs do not verify wiring or electrical continuity.
