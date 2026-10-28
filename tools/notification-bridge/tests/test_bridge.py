import asyncio
import contextlib
import importlib
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
# Unit tests never import a hardware driver or open a BLE connection.
sys.modules['bleak'] = types.SimpleNamespace(BleakClient=object, BleakScanner=object)
tmp = tempfile.TemporaryDirectory()
config_path = Path(tmp.name) / 'config.json'
config_path.write_text(json.dumps({'state_dir': tmp.name, 'timezone':'UTC',
 'source_tailnet_ip':'100.64.0.10', 'home_network':'192.168.1.0/24',
 'device_address':'TEST'}))
os.environ['RESONATOR_CONFIG'] = str(config_path)
import trial
import daemon

class Reader:
 def __init__(self, text): self.text=text
 async def readline(self): return self.text.encode()
class Writer:
 def write(self, data): self.result=json.loads(data)
 async def drain(self): pass
 def close(self): pass
 async def wait_closed(self): pass

class GateTests(unittest.TestCase):
 def test_presence_cache_expires(self):
  clock=[0];calls=[]
  dt=types.SimpleNamespace(datetime=types.SimpleNamespace(now=lambda tz:types.SimpleNamespace(hour=12)))
  run=lambda *a,**k: (calls.append(1) or types.SimpleNamespace(returncode=0,stdout='pong via 192.168.1.20:1234'))
  with patch.object(trial,'datetime',dt),patch.object(trial.time,'monotonic',lambda:clock[0]),patch.object(trial.subprocess,'run',run):
   trial._presence_checked=None
   trial.allowed();clock[0]=1799;trial.allowed();self.assertEqual(len(calls),1)
   clock[0]=1800;trial.allowed();self.assertEqual(len(calls),2)
 def test_quiet_hours_do_not_use_presence_cache(self):
  dt=types.SimpleNamespace(datetime=types.SimpleNamespace(now=lambda tz:types.SimpleNamespace(hour=2)))
  with patch.object(trial,'datetime',dt):
   with self.assertRaisesRegex(RuntimeError,'Quiet hours'):trial.allowed()
 def test_frame_order_and_checksum(self):
  frame=daemon.packet(14,(20,30,40))
  self.assertEqual(frame[:5],bytes([14,0,30,20,40]))
  self.assertEqual(sum(frame)%256,0)

class EffectTests(unittest.IsolatedAsyncioTestCase):
 async def test_latest_source_wins(self):
  c=daemon.Controller();events=[]
  async def effect(kind):
   events.append(('start',kind));c.active=kind
   try:await asyncio.sleep(.03)
   except asyncio.CancelledError:events.append(('cancel',kind));raise
   events.append(('finish',kind))
  c.effect=effect;a=Writer();b=Writer()
  first=asyncio.create_task(c.request(Reader('gpt'),a));await asyncio.sleep(.005)
  await c.request(Reader('wechat'),b);await first
  self.assertEqual(events,[('start','gpt'),('cancel','gpt'),('start','wechat'),('finish','wechat')])
  self.assertTrue(a.result['superseded'])
  c.active='wechat';c.clear.clear()
  await c.request(Reader('clear:gpt'),Writer());self.assertFalse(c.clear.is_set())
 async def test_colored_fade_does_not_select_white(self):
  c=daemon.Controller();writes=[]
  async def write(cmd,rgb=(0,0,0)):writes.append((cmd,rgb))
  c.write=write
  with patch.object(daemon,'allowed',lambda:None):await c.ramp(.03,0,.1,(171,171,180))
  self.assertEqual(writes[-1][1],(0,0,0))
  self.assertTrue(all(cmd==14 for cmd,rgb in writes))
  self.assertTrue(all(not rgb[0] or len(set(rgb))>1 for cmd,rgb in writes))

if __name__=='__main__':unittest.main()
