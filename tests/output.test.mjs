import test from 'node:test';
import assert from 'node:assert/strict';
import {outputRate, isColorReply, EffectClock, FrameSender} from '../web/output.js';
import {LightstickClient, frame, colorFrame, NOTIFY} from '../web/sdk.js';
import {breathBrightness} from '../web/dimming.js';
import {renderColor} from '../web/color.js';

function clock() {
  let time = 0, nextId = 0;
  const jobs = new Map();
  const now = () => time;
  const schedule = (fn, delay) => {
    const id = ++nextId;
    jobs.set(id, {at:time + Math.max(0, delay), fn});
    return id;
  };
  const cancel = id => jobs.delete(id);
  const flush = async () => { for (let i=0; i<16; i++) await Promise.resolve(); };
  const wait = delay => new Promise(resolve => schedule(resolve, delay));
  async function advance(end) {
    assert(end >= time);
    await flush();
    let turns = 0;
    while (true) {
      const next = [...jobs].sort((a,b) => a[1].at-b[1].at || a[0]-b[0])[0];
      if (!next || next[1].at > end) break;
      assert(++turns < 10000, 'timer loop must make progress');
      const [id, job] = next;
      jobs.delete(id); time = job.at; job.fn();
      await flush();
    }
    time = end;
    await flush();
  }
  return {now, schedule, cancel, wait, advance, jobs};
}

function fixture({rate=120, delay=2, readFrame, sendFrame}={}) {
  const time = clock(), samples = [], starts = [], errors = [];
  let active = 0, maxActive = 0;
  const sender = new FrameSender({rate, ...time,
    readFrame: t => {
      samples.push(t);
      return readFrame ? readFrame(t) : [Math.floor(t)%256,Math.floor(t/256)%256,0];
    },
    sendFrame: async rgb => {
      active++; maxActive = Math.max(active,maxActive);
      starts.push({at:time.now(),rgb});
      try { return sendFrame ? await sendFrame(rgb,time) : (await time.wait(delay),true); }
      finally { active--; }
    },
    onError: error => errors.push(error)
  });
  return {time, sender, samples, starts, errors, maxActive:()=>maxActive};
}

test('only supported trial rates are accepted; ordinary URLs retain 60 Hz', () => {
  for (const input of [null,undefined,'',0,-1,30,'120x',Infinity,1000]) assert.equal(outputRate(input),60);
  for (const rate of [60,90,120]) assert.equal(outputRate(String(rate)),rate);
});

test('default timers retain a legal browser receiver instead of the FrameSender instance', async () => {
  const nativeSet=globalThis.setTimeout, nativeClear=globalThis.clearTimeout;
  const legal=receiver=>receiver===undefined || receiver===globalThis;
  let sent=0;
  const errors=[];
  globalThis.setTimeout=function(fn,delay){
    assert(legal(this),'browser setTimeout rejects foreign receivers');
    return nativeSet(fn,delay);
  };
  globalThis.clearTimeout=function(id){
    assert(legal(this),'browser clearTimeout rejects foreign receivers');
    return nativeClear(id);
  };
  const sender=new FrameSender({rate:120,readFrame:()=>[255,0,0],
    sendFrame:async()=>{sent++;return true;},onError:e=>errors.push(e)});
  try {
    sender.start();await new Promise(resolve=>nativeSet(resolve,40));sender.stop();
    assert.equal(sent,1);assert.deepEqual(errors,[]);
  } finally {
    globalThis.setTimeout=nativeSet;globalThis.clearTimeout=nativeClear;
    sender.stop();
  }
});

test('output runs above 60 Hz without any screen animation callback', async () => {
  for (const [rate,expectedGap] of [[60,17],[90,12],[120,9]]) {
    const f = fixture({rate});
    f.sender.start(); await f.time.advance(1000); f.sender.stop();
    assert.equal(f.maxActive(),1);
    assert(f.starts.length >= Math.floor(1000/expectedGap));
    assert(f.starts.length <= Math.ceil(1000/expectedGap));
    for (let i=1;i<f.starts.length;i++) assert.equal(f.starts[i].at-f.starts[i-1].at,expectedGap);
    if (rate === 120) assert(f.starts.length > 100);
  }
});

test('a slow transport samples current state after completion, without stale backlog or another interval', async () => {
  let color = [255,0,0];
  const f = fixture({delay:35,readFrame:()=>color});
  f.sender.start(); await f.time.advance(10); color=[0,255,0];
  await f.time.advance(25); color=[0,0,255];
  await f.time.advance(70); f.sender.stop();
  assert.deepEqual(f.starts.map(x=>x.at),[0,35]);
  assert.deepEqual(f.starts.map(x=>x.rgb),[[255,0,0],[0,0,255]]);
  assert.equal(f.maxActive(),1);
});

test('unchanged colors are deduplicated; invalidation refreshes once; stop cancels timers', async () => {
  const f = fixture({readFrame:()=>[20,0,0]});
  f.sender.start(); await f.time.advance(100);
  assert.equal(f.starts.length,1);
  f.sender.invalidate(); await f.time.advance(150);
  assert.equal(f.starts.length,2);
  f.sender.stop(); await f.time.advance(1000);
  assert.equal(f.starts.length,2);
  assert.equal(f.time.jobs.size,0);
});

test('switching rates in one session changes the next permitted start without overlapping', async () => {
  const f = fixture();
  f.sender.start(); await f.time.advance(20);
  assert.deepEqual(f.starts.map(x=>x.at),[0,9,18]);
  f.sender.setRate(60); await f.time.advance(60);
  assert.deepEqual(f.starts.map(x=>x.at),[0,9,18,35,52]);
  f.sender.setRate(120); await f.time.advance(80); f.sender.stop();
  assert.deepEqual(f.starts.map(x=>x.at),[0,9,18,35,52,61,70,79]);
  assert.equal(f.maxActive(),1);
});

test('stop and restart during a pending write only sends the latest resumed frame', async () => {
  let color=[255,0,0];
  const f = fixture({delay:35,readFrame:()=>color});
  f.sender.start(); await f.time.advance(10); f.sender.stop();
  color=[0,255,0]; f.sender.start();
  await f.time.advance(25); color=[0,0,255];
  await f.time.advance(71); f.sender.stop();
  assert.deepEqual(f.starts.map(x=>x.at),[0,35]);
  assert.deepEqual(f.starts.map(x=>x.rgb),[[255,0,0],[0,0,255]]);
  assert.equal(f.maxActive(),1);
});

test('a failure stops output even if color controls invalidated the pending frame', async () => {
  const f = fixture({sendFrame:async (_,time)=>{await time.wait(20);throw new Error('write failed');}});
  f.sender.start(); await f.time.advance(10); f.sender.invalidate();
  await f.time.advance(100);
  assert.equal(f.starts.length,1);
  assert.equal(f.errors.length,1);
  assert.equal(f.sender.active,false);
  assert.equal(f.time.jobs.size,0);
});

test('a rejected old session cannot stop a resumed session', async () => {
  let first = true;
  const f = fixture({sendFrame:async (_,time)=>{
    await time.wait(20);
    if (first) {first=false;throw new Error('old connection closed');}
    return true;
  }});
  f.sender.start(); await f.time.advance(10); f.sender.stop(); f.sender.start();
  await f.time.advance(65); f.sender.stop();
  assert.equal(f.errors.length,0);
  assert.deepEqual(f.starts.map(x=>x.at),[0,20,40,60]);
  assert.equal(f.maxActive(),1);
});

test('only six-byte color responses with a valid checksum enter the reply counter', () => {
  assert(isColorReply(colorFrame([255,32,32])));
  assert(isColorReply(frame([0xa1,0,32,255,32])));
  for (const data of [[],frame([2,0,0,0,0]),[1,0,0,255,0,1],frame([1,0,0]),new TextEncoder().encode('JFKJ-20250421')]) {
    assert.equal(isColorReply(data),false);
  }
});

test('interleaved UI and output samples share elapsed time without double-counting or reversal', () => {
  const shared = new EffectClock(0), outputOnly = new EffectClock(0);
  for (const t of [0,9,16,18,27,32,36,45,48,54,63,64,72,80,81,90,96,99]) shared.advance(t,3);
  for (let t=0;t<=99;t+=9) outputOnly.advance(t,3);
  assert(Math.abs(shared.time-.297)<1e-12);
  assert(Math.abs(shared.time-outputOnly.time)<1e-12);
  assert.equal(shared.advance(95,3).elapsed,0);
  assert(Math.abs(shared.advance(108,3).time-.324)<1e-12);
  assert(Math.abs(shared.advance(10000,3).time-.624)<1e-12);
  shared.reset(10000); assert.equal(shared.advance(10010,1).time,.01);
});

// Full transport path, using the real SDK and a mock GATT endpoint. This checks
// software cadence and RGB bytes; it makes no claim about physical lamp timing.
async function simulateBreathing(rate, writeDelay=2) {
  const time=clock(), fxClock=new EffectClock(0), writes=[];
  let active=0, maxActive=0;
  const notify=new EventTarget();
  notify.startNotifications=async()=>notify;
  const writer={properties:{writeWithoutResponse:true},
    async writeValueWithResponse(data) {
      notify.value=new DataView(data.buffer,data.byteOffset,data.byteLength);
      notify.dispatchEvent(new Event('characteristicvaluechanged'));
    },
    async writeValueWithoutResponse(data) {
      active++;maxActive=Math.max(active,maxActive);
      writes.push({at:time.now(),data:[...data]});
      await time.wait(writeDelay); active--;
    }
  };
  const device=new EventTarget(); device.name='JFKJ-test';
  device.gatt={connected:false,
    async connect(){this.connected=true;return this;},
    async getPrimaryService(){return{getCharacteristic:async id=>id===NOTIFY?notify:writer};},
    disconnect(){this.connected=false;device.dispatchEvent(new Event('gattserverdisconnected'));}
  };
  const client=new LightstickClient({minGapMs:0,now:time.now,wait:async()=>{},
    bluetooth:{requestDevice:async()=>device}});
  await client.connect();
  const errors=[];
  const sender=new FrameSender({rate,...time,
    readFrame:now=>renderColor([255,0,0],{brightness:breathBrightness(fxClock.advance(now,3).time,1)}),
    sendFrame:rgb=>client.setColor(rgb),onError:e=>errors.push(e)
  });
  // A 60 Hz screen consumes the same clock; the transport still runs separately.
  let uiTicks=0;
  function ui(){uiTicks++;fxClock.advance(time.now(),3);time.schedule(ui,1000/60);}
  ui();sender.start();await time.advance(4000);sender.stop();
  await time.advance(4050);client.disconnect();
  assert.equal(maxActive,1);assert.deepEqual(errors,[]);
  for(const {data} of writes) {
    assert.equal(data.length,6);assert.equal(data[0],1);
    assert.equal(data[2],0);assert.equal(data[4],0);
    assert.equal(data.reduce((a,b)=>a+b,0)&255,0);
  }
  const maxJump=Math.max(...writes.slice(1).map((w,i)=>Math.abs(w.data[3]-writes[i].data[3])));
  return {writes,uiTicks,maxJump};
}

test('120 Hz fast breathing writes through the SDK more often than a 60 Hz display, with smaller steps', async t => {
  const normal=await simulateBreathing(60), fast=await simulateBreathing(120);
  assert(fast.writes.length>fast.uiTicks);
  assert(fast.writes.length>normal.writes.length*1.5);
  assert(fast.maxJump<normal.maxJump);
  for(let i=1;i<fast.writes.length;i++) assert(fast.writes[i].at-fast.writes[i-1].at>=1000/120);
  t.diagnostic(`4 s mock link, 3x red breathing: 60 target ${normal.writes.length} writes / max step ${normal.maxJump}; 120 target ${fast.writes.length} writes / max step ${fast.maxJump}`);
});

test('SDK plus trial sender respect a slow link without concurrent GATT writes', async () => {
  const slow=await simulateBreathing(120,35);
  for(let i=1;i<slow.writes.length;i++) assert(slow.writes[i].at-slow.writes[i-1].at>=35);
});
