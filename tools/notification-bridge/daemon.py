"""Persistent BLE trial with a local Unix socket, no public listener."""
import asyncio, contextlib, json, os, signal, time, math
from pathlib import Path
from bleak import BleakClient, BleakScanner
from trial import COLORS, allowed
from config import CONFIG,ROOT
SOCK=ROOT/'control.sock'
CHAR='0000fa02-0000-1000-8000-00805f9b34fb'
def packet(command,rgb=(0,0,0)):
 r,g,b=rgb; body=[command,0,g,r,b];return bytes(body+[(-sum(body))&255])
class Controller:
 def __init__(self): self.client=None;self.lock=asyncio.Lock();self.lit=False;self.active=None;self.clear=asyncio.Event();self.effect_task=None;self.switch_lock=asyncio.Lock()
 async def write(self,cmd,rgb=(0,0,0)):
  await self.client.write_gatt_char(CHAR,packet(cmd,rgb),response=True)
 async def connect(self):
  if self.client and self.client.is_connected:return
  dev=await BleakScanner.find_device_by_address(CONFIG['device_address'],timeout=12)
  if not dev:raise RuntimeError('Stick unavailable')
  self.client=BleakClient(dev);await self.client.connect()
  await self.client.start_notify('0000fa01-0000-1000-8000-00805f9b34fb',lambda _,d:None)
  await self.client.write_gatt_char(CHAR,b'JFKJ-20250421',response=True)
  await asyncio.sleep(1.5)
  await self.write(13)
 async def effect(self,kind):
  if self.lock.locked():raise RuntimeError('Busy; event dropped')
  async with self.lock:
   self.active=kind;self.clear.clear()
   await asyncio.to_thread(allowed)
   await self.connect()
   try:
    await self.write(13)
    self.lit=True
    await self.write(2,COLORS[kind])
    # Trial duration; adjustable without reconnecting the controller.
    duration=float((ROOT/'breath-seconds').read_text()) if (ROOT/'breath-seconds').exists() else 5.5
    breath_start=time.monotonic()
    try:await asyncio.wait_for(self.clear.wait(),max(1.0,min(10.0,duration)))
    except asyncio.TimeoutError:pass
    if self.clear.is_set():
     # Native PWM level is not readable; estimate phase only for early dismissal.
     scale=(1-math.cos(2*math.pi*(time.monotonic()-breath_start)/2.6))/2
     await self.write(13)
     await self.ramp(scale,0,2.0,COLORS[kind],interruptible=False)
     await self.write(13);self.lit=False;self.active=None
     return
    hold=tuple(round(v*.3) for v in COLORS[kind])
    if len(set(hold))>1:
     # Stop native effect and set color in a single command.
     await self.write(14,hold)
    else:
     # 0d treats equal nonzero RGB as full white: retain safe white path.
     await self.write(13)
     await self.write(1,hold)
    await self.ramp(.3,0,120.0,COLORS[kind])
    await self.write(13)
    self.lit=False;self.active=None
   except BaseException:
    with contextlib.suppress(Exception):await self.write(13)
    self.lit=False;self.active=None
    raise
 async def pause_checked(self,seconds):
  end=time.monotonic()+seconds
  while time.monotonic()<end:
   await asyncio.to_thread(allowed)
   await asyncio.sleep(max(0,min(5,end-time.monotonic())))
 async def ramp(self,start,end,seconds,rgb,interruptible=True):
  begin=time.monotonic();last=None;check=0
  while True:
   now=time.monotonic()
   if now>=check:
    await asyncio.to_thread(allowed);check=time.monotonic()+5
   fraction=min(1,(time.monotonic()-begin)/seconds)
   scale=start+(end-start)*fraction
   if interruptible and self.clear.is_set():
    await self.ramp(scale,0,2.0,rgb,interruptible=False)
    return
   level=tuple(round(v*scale) for v in rgb)
   if len(set(rgb))>1 and level[0]>0 and len(set(level))==1:
    # Rounding must not accidentally switch a tinted color to the W channel.
    values=list(level);values[rgb.index(min(rgb))]-=1;level=tuple(values)
   if level!=last:
    # Equal nonzero RGB via 0e selects full W: retain 01 for white.
    command=1 if level[0]>0 and len(set(level))==1 else 14
    await self.write(command,level);last=level
   if fraction>=1:break
   await asyncio.sleep(.05)
 async def guard(self):
  while True:
   await asyncio.sleep(10)
   if self.lock.locked():continue
   try:await asyncio.to_thread(allowed)
   except Exception:
    async with self.lock:
     if self.lit and self.client and self.client.is_connected:
      with contextlib.suppress(Exception):await self.write(13)
     self.lit=False
 async def request(self,reader,writer):
  try:
   kind=(await asyncio.wait_for(reader.readline(),3)).decode().strip()
   if kind=='status': result={'connected':bool(self.client and self.client.is_connected),'lit':self.lit}
   elif kind.startswith('clear:'):
    if kind[6:]==self.active:self.clear.set()
    result={'ok':True}
   elif kind in COLORS:
    async with self.switch_lock:
     if self.effect_task and not self.effect_task.done():
      self.effect_task.cancel()
      with contextlib.suppress(asyncio.CancelledError):await self.effect_task
     self.effect_task=asyncio.create_task(self.effect(kind))
     task=self.effect_task
    try:
     await task;result={'ok':True,'effect':kind,'idle':'off'}
    except asyncio.CancelledError:result={'ok':True,'effect':kind,'superseded':True}
   else:raise ValueError('Unknown source')
  except Exception as e: result={'ok':False,'error':str(e)}
  try:
   writer.write((json.dumps(result)+'\n').encode());await writer.drain()
  except (BrokenPipeError,ConnectionResetError):pass
  finally:
   writer.close()
   with contextlib.suppress(Exception):await writer.wait_closed()
async def main():
 os.umask(0o077)
 if SOCK.exists():SOCK.unlink()
 c=Controller(); stop=asyncio.Event()
 for sig in (signal.SIGTERM,signal.SIGINT):asyncio.get_running_loop().add_signal_handler(sig,stop.set)
 server=await asyncio.start_unix_server(c.request,path=str(SOCK),limit=128)
 guard=asyncio.create_task(c.guard())
 try:await stop.wait()
 finally:
  server.close();await server.wait_closed();guard.cancel()
  if c.effect_task and not c.effect_task.done():
   c.effect_task.cancel()
   with contextlib.suppress(asyncio.CancelledError,Exception):
    await asyncio.wait_for(c.effect_task,3)
  if c.client and c.client.is_connected:
   with contextlib.suppress(Exception):await asyncio.wait_for(c.write(13),3)
   with contextlib.suppress(Exception):await asyncio.wait_for(c.client.disconnect(),5)
  SOCK.unlink(missing_ok=True)
if __name__=='__main__':asyncio.run(main())
