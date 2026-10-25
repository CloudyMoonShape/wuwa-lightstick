// Host-only GATT double. It models documented dispatch state, not optical output.
import { LightstickClient, frame } from '../../web/sdk.js';
export function nativeLink({ reply = 'match', beforeReply = async () => {}, afterReply = async () => {}, replyTimeoutMs = 100 } = {}) {
  const writes = [], notifications = [], notify = new EventTarget(), device = new EventTarget();
  let last = 0, effect = 'off', rgb = [0,0,0], active = 0, maxActive = 0;
  function emit(data) {
    const payload = Uint8Array.from(data);
    notifications.push([...payload]);
    notify.value = new DataView(payload.buffer);
    notify.dispatchEvent(new Event('characteristicvaluechanged'));
  }
  notify.startNotifications = async () => notify;
  const writer = { properties: {writeWithoutResponse:true},
    async writeValueWithResponse(data) { emit(data); },
    async writeValueWithoutResponse(data) {
      active++; maxActive = Math.max(maxActive, active);
      try {
        writes.push([...data]);
        await beforeReply(data);
        if (data[0] === 1 && [2,4].includes(last)) rgb = [data[3],data[2],data[4]];
        else {
          last = data[0];
          effect = ({1:'direct',2:'breathe',3:'fade',4:'blink',5:'rgb-step',6:'rgb-breathe',7:'rgb-burst',8:'palette-cycle',13:'direct',14:'direct'})[last];
          if ([1,2,4,13,14].includes(last)) rgb = [data[3],data[2],data[4]];
        }
        if (reply === 'match') emit(frame([data[0] | 0xa0, ...data.slice(1,-1)]));
        if (reply === 'wrong') emit(frame([0xa1,0,0,1,0]));
        await afterReply(data);
      } finally { active--; }
    }
  };
  device.name = 'JFKJ-MOCK';
  device.gatt = {connected:false, async connect() { this.connected=true; return this; },
    async getPrimaryService() { return {getCharacteristic:async id => id===0xfa01 ? notify : writer}; },
    disconnect() { this.connected=false; device.dispatchEvent(new Event('gattserverdisconnected')); }
  };
  const client = new LightstickClient({bluetooth:{requestDevice:async()=>device}, wait:async()=>{}, minGapMs:0, replyTimeoutMs});
  return { client, device, writes, notifications, emit, maxActive:()=>maxActive, state:()=>({last,effect,rgb}) };
}
export const flush = async () => { for(let i=0;i<32;i++) await Promise.resolve(); };
export function virtualClock() {
  let time=0,id=0; const jobs=new Map();
  const now=()=>time, schedule=(fn,delay)=>{jobs.set(++id,{fn,at:time+Math.max(0,delay)});return id;}, cancel=id=>jobs.delete(id);
  async function advance(end) {
    await flush(); let turns=0;
    while(true) {
      const next=[...jobs].sort((a,b)=>a[1].at-b[1].at || a[0]-b[0])[0];
      if(!next || next[1].at>end)break;
      if(++turns>10000)throw new Error('timer loop');
      jobs.delete(next[0]);time=next[1].at;next[1].fn();await flush();
    }
    time=end;await flush();
  }
  return {now,schedule,cancel,advance};
}
