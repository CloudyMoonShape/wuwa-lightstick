import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeEffectFrame, continuousColorFrame, frame} from '../sdk/index.mjs';
import {FrameSender, isControlReply} from '../web/output.js';
import {DevicePlayback} from '../web/playback.js';
import {nativeLink, flush, virtualClock} from './helpers/native-link.mjs';

test('native frames match dispatch layouts, GRB and big-endian interval', () => {
  assert.deepEqual([...nativeEffectFrame('breathe',{rgb:[255,0,0]})],[2,0,0,255,0,255]);
  assert.deepEqual([...nativeEffectFrame('fade')],[3,0,253]);
  assert.deepEqual([...nativeEffectFrame('rgb-breathe')],[6,0,250]);
  assert.deepEqual(nativeEffectFrame('blink',{rgb:[12,34,56],intervalMs:1000}),frame([4,0,34,12,56,3,232]));
  assert.deepEqual(nativeEffectFrame('rgb-step',{intervalMs:1000}),frame([5,0,3,232]));
  for(const intervalMs of [0,65535,-1,1.5,NaN,undefined]) assert.throws(()=>nativeEffectFrame('rgb-step',{intervalMs}),RangeError);
  for(const intervalMs of [1,65534]) assert.equal(nativeEffectFrame('rgb-step',{intervalMs}).length,5);
  assert.throws(()=>nativeEffectFrame('unmapped'),RangeError);
  assert.throws(()=>nativeEffectFrame('breathe',{rgb:[256,0,0]}),RangeError);
});

test('continuous colors retain dim white and never use the full-white 0e path',()=>{
  for(let v=1;v<=255;v++) assert.deepEqual(continuousColorFrame([v,v,v]),frame([1,0,v,v,v]));
  assert.deepEqual(continuousColorFrame([12,34,56]),frame([14,0,34,12,56]));
  assert.deepEqual(continuousColorFrame([0,0,0]),frame([14,0,0,0,0]));
  for(const rgb of [[1,2],[1,2,3,4],[-1,0,0],[0,0,0.1]]) assert.throws(()=>continuousColorFrame(rgb),RangeError);
});

test('mode confirmation waits for matching FA01 AND write completion, even when reply arrives first',async()=>{
  let release,done=false;
  const m=nativeLink({afterReply:()=>new Promise(r=>release=r)});await m.client.connect();
  const p=m.client.setNativeEffect('breathe',{rgb:[255,0,0]}).then(()=>done=true);
  await flush();assert.equal(done,false);release();await p;assert.equal(done,true);m.client.disconnect();
});
for(const reply of ['none','wrong']) test(`unconfirmed native command fails closed: ${reply}`,async()=>{
  const m=nativeLink({reply,replyTimeoutMs:10});await m.client.connect();
  await assert.rejects(m.client.setNativeEffect('fade'),/timed out/);
  assert.equal(m.client.ready,false);
});
test('disconnect rejects a pending mode acknowledgment immediately',async()=>{
  const m=nativeLink({reply:'none',replyTimeoutMs:1000});await m.client.connect();
  const p=m.client.setNativeEffect('fade');await flush();m.client.disconnect();
  await assert.rejects(p,/closed during native/);
  m.emit([0xa3,0,0x5d]);assert.equal(m.client.ready,false);
});
test('reply statistics include native and direct commands but reject unrelated or corrupt bytes',()=>{
  for(const body of [[0xa2,0,0,255,0],[0xa3,0],[0xa4,0,0,255,0,1,244],[0xa5,0,1,244],[0xa6,0],[0xad,0,0,0,0],[0xae,0,0,255,0]]) assert.equal(isControlReply(frame(body)),true);
  for(const data of [[],[0xa2,0,0,255,0,0],frame([0xa2,0]),frame([0xa7,0]),frame([0xa1,1,0,1,0])]) assert.equal(isControlReply(data),false);
});

async function rig(options={}) {
  const link=nativeLink(options),time=virtualClock(),errors=[];let rgb=[255,0,0],visible=true;
  await link.client.connect();
  const sender=new FrameSender({...time,rate:120,readFrame:()=>rgb,sendFrame:color=>playback.sendColor(color)});
  const playback=new DevicePlayback({client:link.client,sender,canStream:()=>visible,onError:e=>errors.push(e)});
  return {...link,time,sender,playback,errors,color:value=>{rgb=value;},visible:value=>{visible=value;playback.resume();},
    close:()=>{sender.stop();link.client.disconnect();playback.reset();}};
}
test('native breathing does not stream its envelope; base changes use 01 without restarting it',async()=>{
  const r=await rig();await r.playback.configure({kind:'breathe',rgb:[255,0,0],continuous:true});
  await r.time.advance(100);const settled=r.writes.length;
  await r.time.advance(10000);assert.equal(r.writes.length,settled);
  r.color([255,32,32]);await r.time.advance(10100);
  assert.equal(r.writes.at(-1)[0],1);assert.equal(r.state().effect,'breathe');
  assert.deepEqual(r.state().rgb,[255,32,32]);assert.equal(r.writes.filter(x=>x[0]===2).length,1);
  r.visible(false);await r.time.advance(10200);r.visible(true);await r.time.advance(10300);
  assert.equal(r.writes.filter(x=>x[0]===2).length,1);assert.equal(r.maxActive(),1);assert.deepEqual(r.errors,[]);r.close();
});
test('fixed palette effects issue one confirmed command and never send base colors',async()=>{
  const r=await rig();await r.playback.configure({kind:'fade',continuous:true});await r.time.advance(10000);
  assert.deepEqual(r.writes.map(x=>x[0]),[3]);assert.equal(r.sender.active,false);r.close();
});
test('leaving native breathing and blackout use a reset barrier before colors',async()=>{
  const r=await rig();await r.playback.configure({kind:'breathe',rgb:[255,0,0],continuous:true});await r.time.advance(100);
  await r.playback.configure({kind:'stream',continuous:true});await r.time.advance(200);
  assert.deepEqual(r.writes.slice(-2).map(x=>x[0]),[13,14]);assert.equal(r.state().effect,'direct');
  r.color([30,30,30]);await r.time.advance(300);assert.equal(r.writes.at(-1)[0],1);assert.deepEqual(r.state().rgb,[30,30,30]);
  r.color([0,0,0]);await r.playback.configure({kind:'stream',continuous:true,forceReset:true});await r.time.advance(400);
  assert.deepEqual(r.writes.slice(-2).map(x=>x[0]),[13,14]);assert.deepEqual(r.state().rgb,[0,0,0]);r.close();
});
test('rapid effect changes coalesce; streaming cannot run before reset reply',async()=>{
  let release;
  const r=await rig({beforeReply:data=>data[0]===2?new Promise(resolve=>release=resolve):Promise.resolve()});
  const first=r.playback.configure({kind:'breathe',rgb:[255,0,0],continuous:true});await flush();
  r.playback.configure({kind:'fade',continuous:true});r.playback.configure({kind:'stream',continuous:true});
  await r.time.advance(100);assert.deepEqual(r.writes.map(x=>x[0]),[2]);assert.equal(r.sender.active,false);
  release();await first;await r.time.advance(200);
  assert.deepEqual(r.writes.map(x=>x[0]),[2,13,14]);assert.equal(r.maxActive(),1);r.close();
});
test('a reset reply arriving while the page is hidden cannot resume streaming',async()=>{
  let release;const r=await rig({beforeReply:()=>new Promise(resolve=>release=resolve)});
  const first=r.playback.configure({kind:'stream',continuous:true});await flush();r.visible(false);release();await first;
  assert.equal(r.sender.active,false);r.close();
});
test('ordinary web sessions do not introduce experimental commands',async()=>{
  const r=await rig();await r.playback.configure({kind:'stream',continuous:false});await r.time.advance(100);
  assert.deepEqual(r.writes.map(x=>x[0]),[1]);r.close();
});
