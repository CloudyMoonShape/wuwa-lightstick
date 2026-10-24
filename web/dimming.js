// Shared scalar dimming only; color ratios stay in color.js.
// A gentle quadratic curve retains a linear toe for this 8-bit protocol.
// This is a device-trial curve, not measured perceptual calibration.
const unit = x => Math.max(0, Math.min(1, x));
const ease = x => { x = unit(x); return x * x * (3 - 2 * x); };
export const BREATH_PERIOD = 2 * Math.PI / 1.6;

export function brightnessDrive(level) {
  const p = unit(level);
  return p * (0.4 + 0.6 * p);
}

// One-pole response: ~95% of a slider change in 240 ms, independent of FPS.
// Retarget from the current value; never queue old slider positions.
export class BrightnessSmoother {
  constructor(initial = 1) { this.value = unit(initial); }
  advance(target, elapsedSeconds) {
    target = unit(target);
    const dt = Math.max(0, elapsedSeconds);
    this.value += (target - this.value) * -Math.expm1(-dt / 0.08);
    if (Math.abs(target - this.value) < 1e-5) this.value = target;
    return this.value;
  }
}

export function breathBrightness(time, ceiling, colorPeak = 255) {
  ceiling = unit(ceiling);
  if (!ceiling || colorPeak <= 0) return 0;
  // Start at full output; a single cosine avoids the old double easing/plateau.
  const wave = (1 + Math.cos(time * 1.6)) / 2;
  // Keep the 4% floor at normal brightness. At low ceilings avoid repeated
  // 0/1-code flashes; never raise output above the user's chosen ceiling.
  const floor = Math.min(ceiling, Math.max(ceiling * 0.04, 2 / colorPeak));
  return floor + (ceiling - floor) * brightnessDrive(wave);
}

export function breathHue(time) {
  const cycle = time / BREATH_PERIOD + 0.5;
  const boundary = Math.floor(cycle + 0.5);
  // Change hue only around each dark trough, continuously across cycle wraps.
  return 67 * (boundary - 1 + ease((cycle - boundary + 0.12) / 0.24));
}
