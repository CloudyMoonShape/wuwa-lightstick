// Original heuristic mapping, informed by LED color-space design patterns.
// No measured colorimetry: yellowGreen is a user-adjustable candidate.
export function rgbToHsv(rgb) {
  const [r,g,b] = rgb.map(x => x / 255), max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
  let h = 0;
  if (d) h = max === r ? ((g-b)/d)%6 : max === g ? (b-r)/d+2 : (r-g)/d+4;
  return [((h*60)%360+360)%360, max ? d/max : 0, max];
}
export function wheelRgb(h,s=1,v=1) {
  h=((h%360)+360)%360/60;
  const i=Math.floor(h), f=h-i, p=v*(1-s), q=v*(1-s*f), t=v*(1-s*(1-f));
  return [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i].map(x=>255*x);
}
export function renderColor(rgb, {brightness=1, yellowGreen=96, gains=[1,1,1]}={}) {
  const input=rgb.map(x=>Math.max(0,Math.min(255,x)));
  const peak=Math.max(...input), neutral=Math.max(...input)-Math.min(...input)<1e-8;
  if (!peak || brightness<=0) return [0,0,0];
  let output=input;
  if (!neutral) {
    const [h,s,v]=rgbToHsv(input);
    const yg=Math.max(16,Math.min(255,yellowGreen));
    const anchors=[[0,[255,0,0]],[30,[255,Math.min(32,yg/2),0]],[60,[255,yg,0]],
      [120,[0,255,0]],[180,[0,255,255]],[240,[0,0,255]],[300,[255,0,255]],[360,[255,0,0]]];
    const i=anchors.findIndex((a,j)=>j<anchors.length-1 && h>=a[0] && h<anchors[j+1][0]);
    const [lo,a]=anchors[i], [hi,b]=anchors[i+1], f=(h-lo)/(hi-lo);
    let hue=a.map((x,j)=>x+(b[j]-x)*f);
    const top=Math.max(...hue); hue=hue.map(x=>x*255/top);
    output=hue.map(x=>(255*(1-s)+x*s)*v);
  }
  if (!neutral) {
    output=output.map((x,i)=>x*Math.max(.05,Math.min(1,Number(gains[i])||1)));
    {
      const top=Math.max(...output);
      output=output.map(x=>x*peak/top); // preserve peak, not a claim of constant perceived luminance
    }
  }
  output=output.map(x=>Math.round(x*Math.max(0,Math.min(1,brightness))));
  // Equal nonzero RGB activates W in this firmware. Reserve that for intentional neutrals.
  if (!neutral && output[0]>0 && output.every(x=>x===output[0])) {
    const low=input.indexOf(Math.min(...input)); output[low]--;
  }
  return output;
}
