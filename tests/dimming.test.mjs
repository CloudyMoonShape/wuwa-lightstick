import test from 'node:test';
import assert from 'node:assert/strict';
import {brightnessDrive, BrightnessSmoother, breathBrightness, breathHue, BREATH_PERIOD} from '../web/dimming.js';
import {renderColor, wheelRgb} from '../web/color.js';
import {colorFrame, validChecksum} from '../web/sdk.js';

test('brightness is monotonic, preserves endpoints and keeps 1% red lit', () => {
  assert.equal(brightnessDrive(-1), 0);
  assert.equal(brightnessDrive(1), 1);
  assert.equal(brightnessDrive(2), 1);
  assert.deepEqual(renderColor([255,0,0], {brightness:brightnessDrive(.01)}), [1,0,0]);
  let previous = 0;
  for (let i=0; i<=1000; i++) {
    const p = i/1000, output = brightnessDrive(p);
    assert(output >= previous && output <= p);
    previous = output;
  }
});

test('full brightness preserves accepted palette, gains and raw SDK frames', () => {
  const cases = [
    [[255,0,0],[255,0,0]], [[0,255,0],[0,255,0]], [[0,0,255],[0,0,255]],
    [[255,128,0],[255,32,0]], [[255,255,0],[255,96,0]],
    [[0,255,255],[0,255,255]], [[255,0,255],[255,0,255]],
    [[255,32,32],[255,32,32]], [[255,255,255],[255,255,255]],
  ];
  for (const [input, expected] of cases) {
    const out = renderColor(input, {brightness:brightnessDrive(1)});
    assert.deepEqual(out, expected);
    assert(validChecksum(colorFrame(out)));
  }
  for (const h of [0,30,60,150,240,300]) {
    const options = {gains:[.45,.8,1], yellowGreen:64};
    assert.deepEqual(renderColor(wheelRgb(h), {...options,brightness:brightnessDrive(1)}), renderColor(wheelRgb(h), options));
  }
  assert.deepEqual([...colorFrame([128,0,0])], [1,0,0,128,0,127]);
});

test('dimming scales channels together and never accidentally selects white', () => {
  // These RGB ratios are the already accepted mixed colors, not gamma per channel.
  assert.deepEqual(renderColor([255,32,32], {brightness:brightnessDrive(.5)}), [89,11,11]);
  assert.deepEqual(renderColor([255,255,0], {brightness:brightnessDrive(.5)}), [89,34,0]);
  assert.deepEqual(renderColor([255,255,255], {brightness:brightnessDrive(.5)}), [89,89,89]);
  for (let h=0; h<360; h+=5) for (const s of [.001,.1,.5,1]) for (const p of [.001,.01,.05,.1,.5,1]) {
    const out = renderColor(wheelRgb(h,s), {brightness:brightnessDrive(p)});
    assert(out.every(v => Number.isInteger(v) && v>=0 && v<=255));
    assert(!(out[0]>0 && out.every(v=>v===out[0])));
  }
});

test('slider easing is independent of frame rate and cannot overshoot', () => {
  const outputs = [30,60,120].map(fps => {
    const ramp = new BrightnessSmoother(1);
    let previous = 1;
    for(let i=0; i<fps; i++) {
      const p = ramp.advance(.2, 1/fps);
      assert(p <= previous && p >= .2);
      previous = p;
    }
    return ramp.value;
  });
  assert(Math.max(...outputs)-Math.min(...outputs) < 1e-10);
  assert(Math.abs(outputs[0]-.2)<1e-5);
  const ramp = new BrightnessSmoother(1);
  assert(ramp.advance(0, 1/60) > .5); // A pointer jump does not become a hard cut.
  assert(ramp.advance(0, .24) < .05);
  const before = ramp.value;
  assert.equal(ramp.advance(1, 0), before); // No discontinuity when dragging back.
  assert(ramp.advance(1, 1/60) > before);
  assert.equal(ramp.advance(0, 10), 0); // No replay after a suspended page resumes.
});

test('breathing is periodic, bounded, and has no extra plateau at the dark end', () => {
  for(const p of [.001,.01,.1,.5,1]) for(const peak of [32,255]) {
    const ceiling = brightnessDrive(p);
    assert(Math.abs(breathBrightness(0,ceiling,peak)-ceiling)<1e-12);
    assert(Math.abs(breathBrightness(BREATH_PERIOD,ceiling,peak)-ceiling)<1e-12);
    let previous = ceiling;
    for(let i=0; i<=240; i++) {
      const output = breathBrightness(BREATH_PERIOD*i/480,ceiling,peak);
      assert(output >= 0 && output <= ceiling+1e-12);
      assert(output <= previous+1e-12);
      previous = output;
    }
  }
  assert.equal(breathBrightness(1,0),0);
  assert.equal(breathBrightness(1,1,0),0);
  const bottom = breathBrightness(BREATH_PERIOD/2,1);
  assert(Math.abs(bottom-.04)<1e-12);
  assert(breathBrightness(BREATH_PERIOD/2+.1,1)-bottom > .002);
  // Off remains exact even while the slider smoother is still moving.
  assert.deepEqual(renderColor([0,0,0],{brightness:breathBrightness(1,1)}),[0,0,0]);
});

test('changing-color breaths cross troughs and cycle boundaries without a hue jump', () => {
  for(let n=0; n<8; n++) {
    assert(Math.abs(breathHue(n*BREATH_PERIOD)-n*67)<1e-8);
    for(const phase of [0,.38,.5,.62,1]) {
      const t = (n+phase)*BREATH_PERIOD;
      assert(Math.abs(breathHue(t+.00001)-breathHue(t-.00001))<.01);
    }
  }
});
