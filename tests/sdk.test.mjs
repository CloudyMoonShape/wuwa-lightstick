import test from 'node:test';
import assert from 'node:assert/strict';
import { LightstickClient, colorFrame, frame, validChecksum, SERVICE, NOTIFY } from '../sdk/index.mjs';

function mock({failAuth = false, echo = 'correct', authTimeoutMs = 20, wait,
  now = () => performance.now(), writeDelay = () => Promise.resolve()} = {}) {
  const writes = [], waits = [], states = [], writeStarts = [];
  let active = 0, maxActive = 0;
  const notify = new EventTarget();
  notify.startNotifications = async () => notify;
  const writer = { properties: { writeWithoutResponse: true },
    async writeValueWithResponse(data) {
      if (failAuth) throw new Error('auth transport failed');
      writes.push([...data]);
      if (echo !== 'none') {
        const payload = echo === 'correct' ? data : new TextEncoder().encode('wrong-password');
        notify.value = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
        notify.dispatchEvent(new Event('characteristicvaluechanged'));
      }
    },
    async writeValueWithoutResponse(data) {
      active++; maxActive = Math.max(maxActive, active);
      writeStarts.push(now());
      await writeDelay(); writes.push([...data]); active--;
    } };
  const service = { getCharacteristic: async id => id === NOTIFY ? notify : writer };
  const device = new EventTarget(); device.name = 'JFKJ-FBFB';
  device.gatt = { connected: false, async connect() { this.connected = true; return this; },
    getPrimaryService: async id => { assert.equal(id, SERVICE); return service; },
    disconnect() { this.connected = false; device.dispatchEvent(new Event('gattserverdisconnected')); } };
  const client = new LightstickClient({bluetooth: { requestDevice: async options => {
    assert.deepEqual(options.optionalServices, [SERVICE]); return device;
  } }, authTimeoutMs, now, wait: async ms => { waits.push(ms); if (wait) await wait(ms); }, onState: s => states.push(s)});
  return { client, device, notify, writes, waits, states, writeStarts, max: () => maxActive };
}

test('fast writes stay near 60 Hz without adding transport time to every interval', async () => {
  let clock = 0;
  const m = mock({now: () => clock, writeDelay: () => { clock += 5; }, wait: ms => { clock += ms; }});
  await m.client.connect();
  for (let i = 1; i <= 61; i++) await m.client.setColor([i, 0, 0]);
  const span = m.writeStarts.at(-1) - m.writeStarts[0];
  assert.ok(span >= 1000 && span <= 1030, `60 write intervals took ${span} ms`);
  assert.equal(m.max(), 1);
  m.client.disconnect();
});

test('slow transport remains serial and does not receive an extra frame delay', async () => {
  let clock = 0;
  const m = mock({now: () => clock, writeDelay: () => { clock += 35; }, wait: ms => { clock += ms; }});
  await m.client.connect();
  for (let i = 1; i <= 5; i++) await m.client.setColor([i, 0, 0]);
  assert.equal(m.writeStarts.at(-1) - m.writeStarts[0], 140);
  assert.deepEqual(m.waits, [1200]);
  assert.equal(m.max(), 1);
  m.client.disconnect();
});

test('updates during pacing send the latest color; disconnect cancels waiting colors', async () => {
  let clock = 0, resume;
  const m = mock({now: () => clock, writeDelay: () => { clock += 3; }, wait: ms => {
    if (ms === 1200) { clock += ms; return; }
    return new Promise(resolve => { resume = () => { clock += ms; resolve(); }; });
  }});
  await m.client.connect();
  await m.client.setColor([1, 0, 0]);
  const replaced = m.client.setColor([2, 0, 0]);
  const latest = m.client.setColor([3, 0, 0]);
  assert.equal(await replaced, false);
  resume();
  assert.equal(await latest, true);
  assert.deepEqual(m.writes.slice(1), [[...colorFrame([1, 0, 0])], [...colorFrame([3, 0, 0])]]);
  const cancelled = m.client.setColor([4, 0, 0]);
  m.client.disconnect();
  await assert.rejects(cancelled, /closed/);
  resume();
  await Promise.resolve();
  assert.equal(m.writes.length, 3);
  assert.equal(m.max(), 1);
});

test('known GATT vectors preserve GRB and checksum', () => {
  assert.deepEqual([...colorFrame([255, 0, 0])], [1,0,0,255,0,0]);
  assert.deepEqual([...colorFrame([0,255,0])], [1,0,255,0,0,0]);
  assert.deepEqual([...colorFrame([0,0,0])], [1,0,0,0,0,255]);
  assert.deepEqual([...colorFrame([12,34,56])], [1,0,34,12,56,153]);
  for (const rgb of [[255,255,255],[1,2,3],[0,0,0]]) assert.ok(validChecksum(colorFrame(rgb)));
  assert.equal(validChecksum([1,2,3]), false);
});
test('rejects malformed color/packet input before byte wrapping', () => {
  for (const value of [[-1,0,0],[256,0,0],[1.5,0,0],['1',0,0],[NaN,0,0],[1,2]]) {
    assert.throws(() => colorFrame(value), RangeError);
  }
  assert.throws(() => frame([]), RangeError);
});
test('auth precedes ready and writes; burst updates keep only latest pending frame', async () => {
  const m = mock(); await m.client.connect();
  assert.equal(new TextDecoder().decode(Uint8Array.from(m.writes[0])), 'JFKJ-20250421');
  assert.deepEqual(m.states, ['selecting','connecting','authenticating','ready']);
  assert.equal(m.waits[0], 1200);
  const first = m.client.setColor([1,0,0]);
  const stale = m.client.setColor([2,0,0]);
  const latest = m.client.setColor([3,0,0]);
  assert.deepEqual(await Promise.all([first, stale, latest]), [true,false,true]);
  assert.equal(m.max(), 1);
  assert.deepEqual(m.writes.slice(1), [[...colorFrame([1,0,0])],[...colorFrame([3,0,0])]]);
  m.client.disconnect(); assert.equal(m.device.gatt.connected, false);
  await assert.rejects(m.client.setColor([0,0,0]), /Connect/);
});
test('auth write failure disconnects and cannot claim ready', async () => {
  const m = mock({failAuth: true});
  await assert.rejects(m.client.connect(), /auth transport/);
  assert.equal(m.client.ready, false); assert.equal(m.device.gatt.connected, false);
  assert.equal(m.states.includes('ready'), false);
});
test('physical disconnect resets state; reconnect has fresh transport', async () => {
  const m = mock(); await m.client.connect(); m.device.gatt.disconnect();
  assert.equal(m.client.state, 'disconnected');
  await m.client.connect(); assert.equal(m.client.ready, true); m.client.disconnect();
});
test('disconnect during pending chooser never starts GATT', async () => {
  let choose; let started = false;
  const client = new LightstickClient({bluetooth: {requestDevice: () => new Promise(r => choose = r)}});
  const connecting = client.connect(); client.disconnect();
  choose({gatt: {connect: () => { started = true; }}});
  await assert.rejects(connecting, /cancelled/); assert.equal(started, false);
});
test('disconnect during GATT connect closes a late connection', async () => {
  let finish;
  const device = new EventTarget();
  device.gatt = { connected: false, connect() { return new Promise(r => finish = () => { this.connected = true; r(this); }); }, disconnect() { this.connected = false; } };
  const client = new LightstickClient({bluetooth: {requestDevice: async () => device}});
  const connecting = client.connect(); await Promise.resolve();
  client.disconnect(); finish();
  await assert.rejects(connecting, /cancelled/); assert.equal(device.gatt.connected, false);
});

for (const echo of ['none', 'wrong']) {
  test(`missing or incorrect auth echo cannot become ready: ${echo}`, async () => {
    const m = mock({echo});
    await assert.rejects(m.client.connect(), /Authentication timed out/);
    assert.equal(m.client.ready, false);
    assert.equal(m.device.gatt.connected, false);
    assert.equal(m.states.includes('ready'), false);
  });
}
test('echo may arrive before write completion but ready still waits for blink', async () => {
  let finishBlink;
  const m = mock({wait: () => new Promise(resolve => finishBlink = resolve)});
  const connecting = m.client.connect();
  while (!finishBlink) await Promise.resolve();
  assert.equal(m.client.state, 'authenticating');
  assert.equal(m.client.ready, false);
  finishBlink(); await connecting;
  assert.equal(m.client.ready, true); m.client.disconnect();
});
test('disconnect while waiting for echo promptly rejects and ignores late echo', async () => {
  const m = mock({echo: 'none', authTimeoutMs: 1000});
  const connecting = m.client.connect();
  while (!m.writes.length) await Promise.resolve();
  m.client.disconnect();
  await assert.rejects(connecting, /closed during authentication/);
  const data = new TextEncoder().encode('JFKJ-20250421');
  m.notify.value = new DataView(data.buffer);
  m.notify.dispatchEvent(new Event('characteristicvaluechanged'));
  assert.equal(m.client.ready, false);
  assert.equal(m.states.includes('ready'), false);
});

test('browsers with only the legacy writeValue still authenticate and set colors', async () => {
  // Arrange
  const writes = [];
  const notify = new EventTarget();
  notify.startNotifications = async () => notify;
  const writer = { properties: { write: true }, async writeValue(data) {
    writes.push([...data]);
    notify.value = new DataView(data.buffer, data.byteOffset, data.byteLength);
    notify.dispatchEvent(new Event('characteristicvaluechanged'));
  } };
  const device = new EventTarget(); device.name = 'JFKJ-FBFB';
  device.gatt = { connected: false, async connect() { this.connected = true; return this; },
    getPrimaryService: async () => ({ getCharacteristic: async id => id === NOTIFY ? notify : writer }),
    disconnect() { this.connected = false; } };
  const client = new LightstickClient({ bluetooth: { requestDevice: async () => device }, wait: async () => {} });

  // Act
  await client.connect();
  await client.setColor([255, 0, 0]);

  // Assert
  assert.deepEqual(writes.at(-1), [...colorFrame([255, 0, 0])]);
  client.disconnect();
});
