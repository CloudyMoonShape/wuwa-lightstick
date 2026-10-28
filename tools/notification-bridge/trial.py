"""Bounded NAS trial. Requires a fresh home-LAN source Mac path and daytime."""
import asyncio, datetime, fcntl, ipaddress, re, subprocess, sys, time, threading
from zoneinfo import ZoneInfo
from pathlib import Path
from config import CONFIG,ROOT
COLORS={'claude':(255,32,0),'gpt':(180,180,180),'wechat':(0,255,0),'lark':(0,160,255),'muse':(160,0,255),'telegram':(255,32,96)}
def frame(rgb):
 r,g,b=rgb; body=[1,0,g,r,b]; return bytes(body+[(-sum(body))&255])
_presence_lock=threading.Lock()
_presence_checked=None
_presence_ok=False
def allowed():
 global _presence_checked,_presence_ok
 try: override_until=float((ROOT/'quiet-override-until').read_text())
 except (OSError,ValueError): override_until=0
 if datetime.datetime.now(ZoneInfo(CONFIG['timezone'])).hour<8 and time.time()>=override_until: raise RuntimeError('Quiet hours')
 with _presence_lock:
  now=time.monotonic()
  if _presence_checked is None or now-_presence_checked>=1800:
   _presence_ok=False
   try:
    p=subprocess.run(['tailscale','ping','--c','1','--timeout','3s',CONFIG['source_tailnet_ip']],capture_output=True,text=True,timeout=6)
    m=re.search(r'via (\d+\.\d+\.\d+\.\d+):',p.stdout)
    _presence_ok=bool(p.returncode==0 and m and ipaddress.ip_address(m[1]) in ipaddress.ip_network(CONFIG['home_network']))
   except (OSError,subprocess.TimeoutExpired):pass
   _presence_checked=time.monotonic()
  if not _presence_ok:raise RuntimeError('Source Mac home-LAN check failed (cached for 30 minutes)')
