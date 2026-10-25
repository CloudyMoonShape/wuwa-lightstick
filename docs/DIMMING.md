# Dimming

[中文](zh-CN/DIMMING.md) · [Documentation](README.md)

The browser smooths manual brightness changes and computes its own breathing envelope. Native breathing uses a separate firmware path. See [Native effects](NATIVE-EFFECTS.md).

The dimming stage scales all color channels together. It keeps the accepted color map, yellow adjustment, channel gains, and white-channel protection. At 100% steady brightness, the output is unchanged.

## Brightness conversion

`web/dimming.js` converts the slider position to an overall drive factor. Let `p` be the percentage divided by 100:

```text
d(p) = 0.4p + 0.6p², where 0 ≤ p ≤ 1
```

This curve retains a linear component at low brightness. It is not a measured gamma curve or a luminous-flux calibration. The displayed percentage is a control position, not a measured duty cycle or light output.

| Setting | Settled red output for full-scale pure red |
|---:|---:|
| 0% | 0 |
| 1% | 1 |
| 10% | 12 |
| 25% | 35 |
| 50% | 89 |
| 100% | 255 |

The slider has a 0.1% step. A first-order filter smooths the position with an 80 ms time constant. It completes about 95% of a change in 240 ms. The filter uses elapsed time, so its response does not depend on a 30, 60, or 120 Hz screen rate. A new target starts from the current value. It does not replay old slider positions.

The off button sends zero without waiting for the smoothing filter.

## Browser breathing

1. The default period is approximately 3.93 seconds. The speed control scales time. Breathing starts at the current brightness ceiling.
2. A cosine produces a continuous cycle. The dimming curve above shapes that cycle. The earlier extra `smoothstep` stage was removed.
3. At normal brightness, the floor is 4% of the ceiling. At low brightness, the floor retains approximately two drive units in the strongest channel, but never exceeds the ceiling.
4. Color-changing breathing moves the hue continuously near each dark trough. It does not jump 67° at a cycle boundary. Single-color breathing keeps the selected hue.

If the ceiling is below two drive units, the effect can be shallow or invisible. This avoids repeated transitions between zero and one. It does not add physical output levels.

Values are rounded to eight bits only at the final `renderColor` stage. The white-channel guard still applies. Browser output defaults to a target limit of 60 writes per second. [Output timing](OUTPUT-TIMING.md) describes the 90 and 120 settings. None of these settings add temporal dithering or change the firmware.

Native breathing receives only the mapped base color and brightness ceiling. The firmware supplies the breathing cycle. The browser does not multiply its own breathing envelope into that path.

## Verification

Tests cover monotonic dimming, unchanged full-brightness colors, color ratios, white-channel protection, slider timing, rapid target reversal, breathing bounds, hue continuity, and zero output for the off control.

An offline comparison used ideal 60 Hz sampling, pure red at 100%, and default speed. The largest adjacent drive step changed from 5 to 4. This measures generated commands, not Bluetooth throughput or optical output.

The operator reported some improvement in browser dimming, but still saw steps during fast breathing. Native single-color breathing later received a positive smoothness report on the sample. Neither result is an instrument measurement or acceptance of every effect.

Each channel remains limited to 0–255. Extra slider precision does not add device levels. Low-brightness steps and rounding-induced color shifts can remain visible.

Background: [Adafruit gamma and quantization](https://learn.adafruit.com/led-tricks-gamma-correction?view=all), [TI perceived dimming](https://www.ti.com/document-viewer/lit/html/SLAT163/GUID-0B9B8B31-DEC9-42E8-B9DE-ECF00C650F5E). The curve is an independent implementation.
