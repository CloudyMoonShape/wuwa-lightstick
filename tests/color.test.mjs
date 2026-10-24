import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderColor, wheelRgb, rgbToHsv} from '../web/color.js';
test('preserves observed primaries and accepted pink',()=>{
 for(const c of [[255,0,0],[0,255,0],[0,0,255],[255,32,32]]) assert.deepEqual(renderColor(c),c);
});
test('yellow adjustment changes only mixed yellow and keeps full red',()=>{
 assert.deepEqual(renderColor([255,255,0]),[255,96,0]);
 assert.deepEqual(renderColor([255,255,0],{yellowGreen:64}),[255,64,0]);
 assert.deepEqual(renderColor([0,255,0],{yellowGreen:64}),[0,255,0]);
});
test('dimming remains independent; neutral white reserved; no accidental W',()=>{
 assert.deepEqual(renderColor([255,255,255],{brightness:.5}),[128,128,128]);
 assert.deepEqual(renderColor([255,0,0],{brightness:.5,gains:[.45,1,1]}),[128,0,0]);
 assert.deepEqual(renderColor([255,255,0],{brightness:0}),[0,0,0]);
 for(let h=0;h<360;h++) for(const s of [.001,.1,.5,1]) for(const brightness of [.01,.5,1]) {
  const out=renderColor(wheelRgb(h,s),{brightness});
  assert(out.every(x=>Number.isInteger(x)&&x>=0&&x<=255));
  assert(!(out[0]>0 && out.every(x=>x===out[0])));
 }
});
test('hue mapping has no jumps at anchors and RGB/HSV roundtrip works',()=>{
 for(const h of [0,30,60,120,180,240,300,360]) {
  const a=renderColor(wheelRgb(h-.001)),b=renderColor(wheelRgb(h+.001));
  assert(a.every((x,i)=>Math.abs(x-b[i])<=1));
 }
 for(const c of [[123,45,67],[0,255,128],[55,55,55]]) {
  const [h,s,v]=rgbToHsv(c);assert(wheelRgb(h,s,v).every((x,i)=>Math.abs(x-c[i])<1e-8));
 }
});
