/** Independent host-side SDK; no vendor code, firmware, OTA or radio transmitter. */
// Full 128-bit strings: iOS Web Bluetooth browsers such as Bluefy reject the numeric 16-bit alias.
export const SERVICE = '0000fa00-0000-1000-8000-00805f9b34fb';
export const NOTIFY = '0000fa01-0000-1000-8000-00805f9b34fb';
export const WRITE = '0000fa02-0000-1000-8000-00805f9b34fb';
export const AUTH_BLINK_MS = 1200;
export const AUTH_TIMEOUT_MS = 4000;
const password = () => new TextEncoder().encode('JFKJ-20250421');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Older Web Bluetooth implementations (some iOS browsers) only ship the deprecated writeValue().
const writeWithResponse = (ch, data) => ch.writeValueWithResponse ? ch.writeValueWithResponse(data) : ch.writeValue(data);
const writeFast = (ch, data) => ch.properties?.writeWithoutResponse && ch.writeValueWithoutResponse
  ? ch.writeValueWithoutResponse(data) : writeWithResponse(ch, data);

function bytes(values) {
  const out = Array.from(values);
  if (!out.length || out.some(v => !Number.isInteger(v) || v < 0 || v > 255)) {
    throw new RangeError('Expected nonempty integer bytes (0–255)');
  }
  return out;
}
export function frame(body) {
  const data = bytes(body);
  return Uint8Array.from([...data, (-data.reduce((a, b) => a + b, 0)) & 255]);
}
export function colorFrame(rgb) {
  return directFrame(1, rgb);
}
function directFrame(command, rgb) {
  const data = bytes(rgb);
  if (data.length !== 3) throw new RangeError('Expected exactly [red, green, blue]');
  const [r, g, b] = data;
  return frame([command, 0, g, r, b]);
}
// 0x0e skips repeated effect teardown, but equal nonzero RGB means FULL white.
// Keep 0x01 for dimmable white. Establish direct mode with stopNativeEffect first.
export function continuousColorFrame(rgb) {
  const data = bytes(rgb);
  return directFrame(data[0] > 0 && data.every(v => v === data[0]) ? 1 : 14, data);
}
export function nativeEffectFrame(kind, { rgb, intervalMs } = {}) {
  if (kind === 'breathe') return directFrame(2, rgb);
  if (kind === 'fade') return frame([3, 0]);
  if (kind === 'rgb-breathe') return frame([6, 0]);
  if (kind === 'rgb-burst') return frame([7, 0]);
  if (kind === 'palette-cycle') return frame([8, 0]);
  if (!['blink', 'rgb-step'].includes(kind)) throw new RangeError('Unknown native effect');
  if (!Number.isInteger(intervalMs) || intervalMs < 1 || intervalMs > 65534) {
    throw new RangeError('Native interval must be an integer from 1 to 65534 ms');
  }
  const timing = [intervalMs >> 8, intervalMs & 255];
  return kind === 'blink' ? frame([...directFrame(4, rgb).slice(0, -1), ...timing]) : frame([5, 0, ...timing]);
}
export function validChecksum(data) {
  const values = bytes(data);
  return (values.reduce((a, b) => a + b, 0) & 255) === 0;
}

export class LightstickClient {
  constructor({ onState = () => {}, onNotification = () => {}, onWrite = () => {}, bluetooth,
    // Injection makes timing testable; applications should retain these defaults.
    wait = sleep, now = () => performance.now(), authDelayMs = AUTH_BLINK_MS,
    authTimeoutMs = AUTH_TIMEOUT_MS, replyTimeoutMs = 1500, minGapMs = 1000 / 60 } = {}) {
    this.onState = onState;
    this.onNotification = onNotification;
    this.onWrite = onWrite;
    this.bluetooth = bluetooth;
    this.wait = wait;
    this.now = now;
    this.authDelayMs = authDelayMs;
    this.authTimeoutMs = authTimeoutMs;
    this.replyTimeoutMs = replyTimeoutMs;
    this.minGapMs = minGapMs;
    this.session = null;
    this.state = 'disconnected';
  }
  get device() { return this.session?.device ?? null; }
  get ready() { return this.state === 'ready' && !!this.session?.device?.gatt.connected; }
  _state(state, detail) { this.state = state; this.onState(state, detail); }
  _check(s) {
    if (this.session !== s || !s.device?.gatt.connected) throw new Error('Connection closed');
  }
  async connect() {
    if (this.session) throw new Error('Already connecting or connected');
    const bluetooth = this.bluetooth ?? globalThis.navigator?.bluetooth;
    if (!bluetooth) throw new Error('Web Bluetooth is unavailable; use a supported browser over HTTPS or localhost');
    const s = { pending: null, busy: false };
    this.session = s;
    try {
      this._state('selecting');
      const device = await bluetooth.requestDevice({ filters: [{ namePrefix: 'JFKJ' }], optionalServices: [SERVICE] });
      if (this.session !== s) throw new Error('Connection cancelled');
      s.device = device;
      s.disconnected = () => { if (this.session === s) this.disconnect(); };
      device.addEventListener('gattserverdisconnected', s.disconnected);
      this._state('connecting', device.name);
      const server = await device.gatt.connect();
      if (this.session !== s) {
        if (device.gatt.connected) device.gatt.disconnect();
        throw new Error('Connection cancelled');
      }
      this._check(s);
      const service = await server.getPrimaryService(SERVICE);
      this._check(s);
      s.notify = await service.getCharacteristic(NOTIFY);
      this._check(s);
      s.notification = event => {
        if (this.session !== s) return;
        const v = event.target.value;
        const data = new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice();
        const expected = password();
        if (data.length === expected.length && data.every((b, i) => b === expected[i])) {
          s.acceptAuth?.();
        }
        if (s.expectedReply?.length === data.length && data.every((b, i) => b === s.expectedReply[i])) s.acceptReply?.();
        this.onNotification(data);
      };
      s.notify.addEventListener('characteristicvaluechanged', s.notification);
      await s.notify.startNotifications();
      this._check(s);
      s.write = await service.getCharacteristic(WRITE);
      this._check(s);
      this._state('authenticating');
      // Arm before writing: the echo can arrive before the write promise resolves.
      let timer;
      const authenticated = new Promise((resolve, reject) => {
        s.acceptAuth = resolve;
        s.rejectAuth = reject;
        timer = setTimeout(() => reject(new Error('Authentication timed out: no matching password echo')), this.authTimeoutMs);
      });
      try {
        await Promise.all([
          authenticated,
          Promise.resolve().then(() => { this._check(s); return writeWithResponse(s.write, password()); })
        ]);
      } finally {
        clearTimeout(timer);
        s.acceptAuth = null;
        s.rejectAuth = null;
      }
      this._check(s);
      await this.wait(this.authDelayMs);
      this._check(s);
      this._state('ready', device.name);
      return device;
    } catch (error) {
      if (this.session === s) { this.disconnect(); this._state('error', error.message); }
      throw error;
    }
  }
  setColor(rgb) {
    return this._enqueue(colorFrame(rgb));
  }
  setContinuousColor(rgb) { return this._enqueue(continuousColorFrame(rgb)); }
  setNativeEffect(kind, options) { return this._enqueue(nativeEffectFrame(kind, options), true); }
  // 0x01 only changes the base color while native breathing/blinking is active.
  // 0x0d always tears down the effect, even after a physical button press.
  stopNativeEffect() { return this._enqueue(directFrame(13, [0, 0, 0]), true); }
  _enqueue(data, confirm = false) {
    if (!this.ready) return Promise.reject(new Error('Connect before setting a color'));
    const s = this.session;
    return new Promise((resolve, reject) => {
      // No stale animation backlog: superseded frames resolve false.
      if (s.pending) s.pending.resolve(false);
      s.pending = { data, confirm, resolve, reject };
      void this._pump(s);
    });
  }
  async _pump(s) {
    if (s.busy) return;
    s.busy = true;
    try {
      while (s.pending && this.session === s) {
        const item = s.pending;
        s.pending = null;
        try {
          this._check(s);
          const started = this.now();
          let timer;
          try {
            const reply = item.confirm ? new Promise((resolve, reject) => {
              s.expectedReply = frame([item.data[0] | 0xa0, ...item.data.slice(1, -1)]);
              s.acceptReply = resolve; s.rejectReply = reject;
              timer = setTimeout(() => reject(new Error('Native command timed out: no matching device reply')), this.replyTimeoutMs);
            }) : Promise.resolve();
            await Promise.all([reply, Promise.resolve().then(async () => {
              this._check(s);
              await writeFast(s.write, item.data);
              this._check(s);
              this.onWrite(item.data.slice(), this.now() - started);
            })]);
          } finally {
            clearTimeout(timer);
            s.expectedReply = null; s.acceptReply = null; s.rejectReply = null;
          }
          this._check(s);
          item.resolve(true);
          // Pace write starts, not write completion plus another full interval.
          // A slower transport already consumed the interval; do not delay it again.
          const remaining = this.minGapMs - (this.now() - started);
          if (remaining > 0) await this.wait(Math.ceil(remaining));
        } catch (error) {
          item.reject(error);
          if (this.session === s) { this.disconnect(); this._state('error', error.message); }
          break;
        }
      }
    } finally { s.busy = false; }
  }
  disconnect() {
    const s = this.session;
    this.session = null;
    if (s) {
      s.rejectAuth?.(new Error('Connection closed during authentication'));
      s.rejectReply?.(new Error('Connection closed during native command'));
      s.pending?.reject(new Error('Connection closed'));
      s.pending = null;
      s.notify?.removeEventListener('characteristicvaluechanged', s.notification);
      s.device?.removeEventListener('gattserverdisconnected', s.disconnected);
      if (s.device?.gatt.connected) s.device.gatt.disconnect();
    }
    this._state('disconnected');
  }
}
