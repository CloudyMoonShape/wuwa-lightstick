// The controller owns pacing; its SDK client uses minGapMs: 0 to avoid two waits.
// Rendering may run at 60 Hz while the device samples the current scene faster.
export const OUTPUT_RATES = [60, 90, 120];
export function outputRate(value) {
  const rate = Number(value);
  return OUTPUT_RATES.includes(rate) ? rate : 60;
}

export function isColorReply(data) {
  return data.length === 6 && (data[0] === 0x01 || data[0] === 0xa1)
    && (data.reduce((sum, byte) => sum + byte, 0) & 255) === 0;
}

export class EffectClock {
  constructor(now = 0) { this.reset(now); }
  reset(now) { this.last = now; this.time = 0; }
  advance(now, speed = 1) {
    const elapsed = Math.max(0, now - this.last) / 1000;
    this.last = Math.max(this.last, now);
    this.time += Math.min(0.1, elapsed) * speed;
    return {time: this.time, elapsed};
  }
}

export class FrameSender {
  constructor({readFrame, sendFrame, onError = () => {}, rate = 60,
    now = () => performance.now(),
    schedule = (fn, delay) => setTimeout(fn, delay), cancel = id => clearTimeout(id)}) {
    Object.assign(this, {readFrame, sendFrame, onError, now, schedule, cancel});
    this.rate = outputRate(rate);
    this.active = false;
    this.busy = false;
    this.timer = null;
    this.lastStarted = -Infinity;
    this.revision = 0;
    this.session = 0;
    this.lastKey = null;
  }
  invalidate() { this.lastKey = null; this.revision++; }
  setRate(value) {
    this.rate = outputRate(value);
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
    this._schedule();
  }
  start() {
    if (this.active) return;
    this.active = true;
    this.session++;
    this.invalidate();
    this._schedule();
  }
  stop() {
    this.active = false;
    this.session++;
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
    this.invalidate();
  }
  _schedule() {
    if (!this.active || this.busy || this.timer !== null) return;
    const remaining = 1000 / this.rate - (this.now() - this.lastStarted);
    this.timer = this.schedule(() => {
      this.timer = null;
      void this._tick();
    }, Math.max(0, Math.ceil(remaining)));
  }
  async _tick() {
    if (!this.active || this.busy) return;
    const remaining = 1000 / this.rate - (this.now() - this.lastStarted);
    if (remaining > 0) { this._schedule(); return; }
    this.busy = true;
    this.lastStarted = this.now();
    const revision = this.revision;
    const session = this.session;
    try {
      // Sample only when the previous write is done; do not queue old frames.
      const rgb = this.readFrame(this.lastStarted), key = rgb.join();
      if (key !== this.lastKey) {
        const sent = await this.sendFrame(rgb);
        if (sent && this.active && revision === this.revision) this.lastKey = key;
      }
    } catch (error) {
      // A failed old session must not stop a newer connection/visibility session.
      if (this.active && session === this.session) { this.stop(); this.onError(error); }
    } finally {
      this.busy = false;
      this._schedule();
    }
  }
}
