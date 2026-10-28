import socket,sys,json,time
from pathlib import Path
from config import ROOT
with socket.socket(socket.AF_UNIX) as s:
 s.settimeout(240);s.connect(str(ROOT/'control.sock'))
 if sys.argv[1] not in ('status',) and not sys.argv[1].startswith('clear:'):print(json.dumps({'event':'nas_received','at':time.time(),'source':sys.argv[1]}),flush=True)
 s.sendall((sys.argv[1]+'\n').encode())
 result=json.loads(s.recv(4096).decode())
 print(json.dumps(result))
 if result.get("ok") is False: sys.exit(1)
