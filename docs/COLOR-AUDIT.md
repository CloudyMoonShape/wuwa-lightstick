# Color audit

[中文](zh-CN/COLOR-AUDIT.md) · [Documentation](README.md)

This record describes the changes made on 2026-10-24. The current implementation is in [Color mixing](COLOR-MIXING.md).

The sample operator checked raw red `[255,0,0]`, green `[0,255,0]`, and blue `[0,0,255]` by eye. All three looked correct. The operator also accepted pink `[255,32,32]`. These checks were not colorimeter measurements.

| Finding | Change | Evidence limit |
|---|---|---|
| The old red, green, and blue swatches used decorative screen colors: `ff2040`, `3dff6e`, and `2f6bff`. | Use pure RGB reference colors as swatch inputs. | The browser applies the current color mapping before transmission. |
| Orange `ff8000` looked green. | Reduce green in the orange output to `ff2000`. | This was an empirical adjustment on one sample. |
| Yellow looked green. | Use a hue map with yellow `[255,96,0]` by default. | The green value is adjustable. It is not a calibrated ratio. |
| Equal nonzero RGB values select the firmware white channel. | Reserve equal RGB for intended white and gray. | The interface does not expose independent RGBW control. |

Static themes and beat-driven color changes use the same swatch table. The police-light blue changed from `[0,40,255]` to `[0,0,255]`.

The early audit passed JavaScript syntax checks, the site build, and 11 SDK tests. Later color-map checks passed. The operator reported a large visual improvement and selected the empirical map as the only browser color mode. These are historical results, not the current test count.

The SDK and CLI still accept raw RGB values. Use them to separate a protocol test from a browser color-map test. For a browser comparison, set brightness to 100% and disable manual channel correction. Existing local settings are not erased automatically.
