<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/resonator-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/resonator-light.svg">
  <img alt="Resonator" src="docs/assets/resonator.svg" width="360">
</picture>

Resonator controls your Wuthering Waves concert lightstick from a browser.

**[Open controller](https://wuwa.south-wall.com/?lang=en)** · [Documentation](docs/README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

[![Current controller with the color wheel, native effects, extended effects, and music controls](docs/screenshots/controller-desktop-en.png)](https://wuwa.south-wall.com/?lang=en)

Choose a color. Play an effect. Make the light follow your music. No account or firmware change is required.

| Native effects | Extended effects | Music |
|---|---|---|
| The lightstick runs its own timers. | The browser sends custom color sequences. | The browser analyzes a file, shared tab audio, or microphone input. |
| Smooth breathing, RGB fades, and preset cycles. | Adjustable breathing, heartbeat, candlelight, and custom palettes. | Audio analysis stays on your device. |

[Mobile view](docs/screenshots/controller-mobile-en.png) · [How it works](docs/screenshots/principles-desktop-en.png)

## Connect

1. Open the controller in Chrome on Android, macOS, or Windows, or Edge on Windows or macOS.
2. Select **Connect lightstick**.
3. Select your device, named `JFKJ-FBFB`.
4. Wait for the three blue flashes. Then choose a color or effect.

The website supports Chinese, English, and Japanese. It uses your browser language unless you choose another language. See [language selection](docs/LOCALIZATION.md).

Safari and Chrome on iPhone or iPad do not provide native Web Bluetooth. They support screen previews only. Use the Bluefy browser to connect. It requires installation and is not native Safari or Chrome support. Open the connection guide for device-specific steps. See [browser support](docs/SDK.md).

The research sample has board `HE-750G24` and firmware `V4.1.8`. Other hardware or firmware versions can behave differently. Flashing effects require a separate opt-in.

Cannot connect, or keep losing the connection? The batteries may be depleted. Replace the full set with new batteries and try again. If it still fails, check Bluetooth permission and close other pages or apps connected to the lightstick.

## How it works

```mermaid
flowchart LR
  Page[Static page] --> Browser[Browser]
  Browser -->|Web Bluetooth| Stick[Your lightstick]
  Audio[Local audio] --> Browser
```

The page loads from Cloudflare Pages. After it loads, control commands go directly from your browser to the lightstick. An optional visitor counter uses a separate service. Control does not depend on that service.

The JavaScript SDK is an independent host implementation. It does not contain manufacturer firmware or vendor SDK code.

| Build or study | Read |
|---|---|
| Connect and send commands | [SDK](docs/SDK.md) |
| Use firmware effects | [Native effects](docs/NATIVE-EFFECTS.md) |
| Understand color and brightness | [Color mixing](docs/COLOR-MIXING.md) · [Dimming](docs/DIMMING.md) |
| Inspect the hardware and protocol | [Hardware](docs/HARDWARE.md) · [Protocol](docs/PROTOCOL.md) |
| Continue firmware research | [Function map](docs/FUNCTIONS.md) · [Analysis tools](re/README.md) |

## Run locally

Use Node.js 24 and Python 3. No npm packages are required for the controller build.

```sh
npm test
npm run build
python3 -m http.server 8765 -d dist
```

Open [localhost:8765](http://localhost:8765). Build before you serve the page: the build inserts the shared header and footer. Web Bluetooth requires HTTPS or localhost.

For the separate SDK examples, serve the repository root and open `/sdk/examples/color.html`. See [deployment](docs/DEPLOYMENT.md) for Pages and the optional visitor database.

## Evidence

The research sample has hardware records for connection, primary colors, selected mixed colors, and native single-color breathing. The user reported smooth native breathing. Color tuning is based on visual observation, not instrument measurements.

Automated tests check frames, transport behavior, color mapping, dimming, and visitor counting. They do not prove optical timing or compatibility with other devices. Venue broadcast behavior comes from static firmware analysis and has not been tested over radio. See [verification](docs/VERIFICATION.md).

## License

Free use, modification, sharing, and free hosting are permitted. Software sales, paid access, paid hosting, and paid bundles are prohibited without separate written permission.

The [Community License](LICENSE) is source-available. It is not an OSI-approved open-source license. [Third-party materials](THIRD_PARTY.md) retain separate rights.

[Contribute](CONTRIBUTING.md) · [Report a security issue](SECURITY.md)

[iPhone connection guide](docs/IOS.md)
