# Verification

[Documentation](README.md) · [简体中文](zh-CN/VERIFICATION.md)

Evidence below was recorded on or before 2026-10-24. A software test, a simulated device, and a physical observation are different kinds of evidence. Do not substitute one for another.

## Documentation release check — 2026-10-24

The documentation audit passed 68 existing automated tests and the site build. The documentation checker passed 297 local links across 48 Markdown files and 24 translation pairs. Current desktop, mobile, and principles screenshots were captured from the live site. Python research scripts passed compilation after text-only edits. No hardware test was performed for this documentation update.

The build reported 167,707 bytes of controller HTML and a 46,298-byte gzip estimate. These are build measurements, not transfer timings. Public-release limitations remain in [Public release review](PUBLIC-RELEASE.md).

## Physical observations

| Area | Recorded result | Limit |
|---|---|---|
| GATT connection | The original tools completed the passphrase exchange and set colors on the sample. | This is not a complete regression test of every later SDK revision. |
| RGB channels | The user reported normal red, green, and blue from direct commands. | No instrument measurements. |
| Color mapping | The user accepted the revised pink and reported a large improvement with perceptual mixing. | One sample and visual judgment; not colorimetric calibration. |
| Dimming | The user reported some improvement after the dimming change. | Rapid browser-driven breathing still showed steps. |
| Native breathing (`02`) | The user reported much smoother breathing. | No optical curve, latency, or frame-rate measurement. Do not extend this result to other native modes. |

The research sample is described in [Hardware](HARDWARE.md). Firmware addresses and inferred behavior are in [Functions](FUNCTIONS.md) and [Native effects](NATIVE-EFFECTS.md).

## Software checks

The last recorded effect-library test run passed 68 automated checks. That count is historical. Run `npm test` to check the revision you use.

The suite covers:

- Frame bytes, GRB order, checksums, and input limits.
- Authentication order, exact echo matching, animation delay, cancellation, and disconnect paths.
- One write in progress, replacement of pending colors, slow writes, and output scheduling.
- Color mapping, white-channel protection, dimming curves, and breathing boundaries.
- Native command replies, mode transitions, exit barriers, fixed presets, and late audio-source results.
- Visitor identities, SQL uniqueness, transactions, request limits, origin checks, and failure handling.

Simulated writes and replies do not measure real Bluetooth throughput or optical latency. Tests of `node:sqlite` do not verify a production D1 binding.

## Browser and deployment records

Earlier browser checks covered desktop and narrow layouts, light and dark themes, keyboard focus, color controls, effect categories, flashing opt-in, local audio playback, and simulated Bluetooth transitions.

Background failure and slow loading were tested without blocking the controls. Tests with the Bluetooth interface removed kept screen preview available. These were browser simulations, not physical iPhone tests. The connection guide dialog was checked at 375 px and desktop widths for opening, closing, tab switching, and URL copying. In Bluefy on an iPhone, the old SDK failed before the device chooser appeared; the fix (full 128-bit UUIDs and a `writeValue()` fallback) passes a simulated legacy-write endpoint and awaits a real iPhone retest.

The visitor counter was tested in an isolated local database. Thirty-two requests with the same ID incremented the total once. A production browser then registered once and reused its identity across refreshes and tabs. No test IDs were inserted into the production database.

Published pages and selected assets were read back and compared with build output during earlier releases. Header alignment and copy were checked again after later visual changes. These records do not certify every browser or every future deployment.

One mainland China IPv6 measurement is documented in [Network measurements](PERFORMANCE.md). It is a historical network test, not a nationwide speed guarantee.

## Still to verify

- Complete real-device regression for the current SDK: connect, disconnect, reconnect, mode changes, and failure recovery.
- Each native mode other than the reported single-color breathing observation.
- Optical brightness curves, color accuracy, and end-to-end music synchronization.
- Sustained real Bluetooth write rates and firmware processing limits.
- Other hardware batches and firmware versions.
- Venue RF reception and the inferred broadcast settings.

No OTA write, firmware modification, or venue RF transmission was performed as part of these web and documentation checks.

## Record a new result

Record the commit, board, firmware version, browser, operating system, input bytes, response bytes, steps, date, and visible result. State whether the result came from a real device, a simulation, or static analysis. Attach the evidence needed to reproduce it. Do not include device identifiers or private data that the test does not need.
