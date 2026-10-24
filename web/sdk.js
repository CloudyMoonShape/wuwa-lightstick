/** Independent host-side SDK; no vendor code, firmware, OTA or radio transmitter. */
export const SERVICE = 0xfa00;
export const NOTIFY = 0xfa01;
export const WRITE = 0xfa02;
export const AUTH_BLINK_MS = 1200;
export const AUTH_TIMEOUT_MS = 4000;
const password = () => new TextEncoder().encode('JFKJ-20250421');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  const data = bytes(rgb);
  if (data.length !== 3) throw new RangeError('Expected exactly [red, green, blue]');
  const [r, g, b] = data;
  return frame([1, 0, g, r, b]);
}
export function validChecksum(data) {
  const values = bytes(data);
  return (values.reduce((a, b) => a + b, 0) & 255) === 0;
}

export class LightstickClient {
  constructor({ onState = () => {}, onNotification = () => {}, bluetooth,
    // Injection makes timing testable; applications should retain these defaults.
    wait = sleep, now = () => performance.now(), authDelayMs = AUTH_BLINK_MS,
    authTimeoutMs = AUTH_TIMEOUT_MS, minGapMs = 1000 / 60 } = {}) {
    this.onState = onState;
    this.onNotification = onNotification;
    this.bluetooth = bluetooth;
    this.wait = wait;
    this.now = now;
    this.authDelayMs = authDelayMs;
    this.authTimeoutMs = authTimeoutMs;
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
          Promise.resolve().then(() => { this._check(s); return s.write.writeValueWithResponse(password()); })
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
    const data = colorFrame(rgb);
    if (!this.ready) return Promise.reject(new Error('Connect before setting a color'));
    const s = this.session;
    return new Promise((resolve, reject) => {
      // No stale animation backlog: superseded frames resolve false.
      if (s.pending) s.pending.resolve(false);
      s.pending = { data, resolve, reject };
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
          if (s.write.properties.writeWithoutResponse) await s.write.writeValueWithoutResponse(item.data);
          else await s.write.writeValueWithResponse(item.data);
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
      s.pending?.reject(new Error('Connection closed'));
      s.pending = null;
      s.notify?.removeEventListener('characteristicvaluechanged', s.notification);
      s.device?.removeEventListener('gattserverdisconnected', s.disconnected);
      if (s.device?.gatt.connected) s.device.gatt.disconnect();
    }
    this._state('disconnected');
  }
}
