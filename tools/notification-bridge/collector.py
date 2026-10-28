"""Read notification metadata only. No content or backlog replay."""
import shlex,contextlib,argparse,json,os,sqlite3,subprocess,time,select
from pathlib import Path
from config import CONFIG,ROOT
REMOTE=shlex.quote(CONFIG["remote_python"])+" "+shlex.quote(CONFIG["remote_send"])+" "
APPS={'com.anthropic.claudefordesktop':'claude','com.openai.chat':'gpt','com.openai.codex':'gpt','com.tencent.xinwechat':'wechat','com.larksuite.larkapp':'lark','com.larksuite.larkapp-notifier':'lark','com.electron.lark':'lark','com.larksuite.larkapp.iron':'lark','com.meta.endo':'muse','ru.keepcoder.telegram':'telegram'}
p=argparse.ArgumentParser();p.add_argument('--seconds',type=int,default=60);p.add_argument('--send',action='store_true');args=p.parse_args()
db=os.path.expanduser('~/Library/Group Containers/group.com.apple.usernoted/db2/db')
state=ROOT/'collector-status.json'
last_status=None;last_status_time=0
def status(**data):
 global last_status,last_status_time
 now=time.monotonic()
 if data==last_status and now-last_status_time<30:return
 last_status=data.copy();last_status_time=now
 state.parent.mkdir(parents=True,exist_ok=True)
 temp=state.with_suffix('.tmp');temp.write_text(json.dumps({'time':time.time(),**data}));temp.replace(state)
def query(sql,params=()):
 with contextlib.closing(sqlite3.connect('file:'+db+'?mode=ro',uri=True,timeout=.2)) as c:return c.execute(sql,params).fetchall()
class DatabaseWatch:
 """macOS vnode events; watch WAL and its parent to cover WAL rotation."""
 def __init__(self,path):
  self.path=path;self.kq=select.kqueue();self.fds={}
 def refresh(self):
  paths=[str(Path(self.path).parent),self.path,self.path+'-wal']
  for path in paths:
   try:
    st=os.stat(path);ident=(st.st_dev,st.st_ino)
   except FileNotFoundError:ident=None
   old=self.fds.get(path)
   if old and old[1]==ident:continue
   if old:os.close(old[0]);del self.fds[path]
   if ident:
    fd=os.open(path,getattr(os,'O_EVTONLY',0x8000))
    flags=select.KQ_NOTE_WRITE|select.KQ_NOTE_DELETE|select.KQ_NOTE_RENAME|select.KQ_NOTE_EXTEND
    self.kq.control([select.kevent(fd,filter=select.KQ_FILTER_VNODE,flags=select.KQ_EV_ADD|select.KQ_EV_CLEAR,fflags=flags)],0,0)
    self.fds[path]=(fd,ident)
 def wait(self,seconds):
  events=self.kq.control(None,8,max(0,seconds))
  if events:time.sleep(.03) # Coalesce a write burst before reading committed rows.
watch=DatabaseWatch(db)
last=None;identity=None;cooldown={};child=None;source=None;started=0;tracked=set();cleared=False
end=time.monotonic()+args.seconds if args.seconds>0 else float('inf')
while time.monotonic()<end:
 try:
  watch.refresh()
  if child and child.poll() is not None:
   print(json.dumps({'source':source,'sent':child.returncode==0}),flush=True);child=None;tracked.clear()
  if child and time.monotonic()-started>240:child.kill();child.wait();child=None
  stat=os.stat(db);current=(stat.st_dev,stat.st_ino)
  top=query('select coalesce(max(rec_id),0) from record')[0][0]
  if identity!=current or last is None or top<last:last=top;identity=current
  rows=query('select r.rec_id,a.identifier,r.delivered_date from record r join app a on a.app_id=r.app_id where r.rec_id>? order by r.rec_id',(last,))
  for rid,bundle,stamp in rows:
   last=rid;kind=APPS.get(bundle)
   if not kind or not stamp or not 0<=time.time()-(stamp+978307200)<30:continue
   if child and kind==source:
    tracked.add(rid)
    continue
   if child:
    # Close the old SSH client; the new NAS request preempts the old effect.
    child.terminate()
    try:child.wait(timeout=1)
    except subprocess.TimeoutExpired:child.kill();child.wait()
    child=None;tracked.clear()
   # A different source must never be dropped by the previous source's cooldown.
   if kind==source and time.monotonic()-cooldown.get(kind,-100)<15:continue
   cooldown[kind]=time.monotonic()
   if args.send:
    print(json.dumps({'event':'dispatch','source':kind,'at':time.time(),'notification_age_ms':round((time.time()-(stamp+978307200))*1000)}),flush=True)
    child=subprocess.Popen(['/usr/bin/ssh','-o','BatchMode=yes','-o','ConnectTimeout=5','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2',CONFIG['ssh_host'],REMOTE+shlex.quote(kind)],stdout=None,stderr=None)
    source=kind;started=time.monotonic();tracked={rid};cleared=False
  if child and tracked and not cleared:
   present={r[0] for r in query('select rec_id from record')}
   if not tracked.intersection(present):
    result=subprocess.run(['/usr/bin/ssh','-o','BatchMode=yes','-o','ConnectTimeout=5',CONFIG['ssh_host'],REMOTE+shlex.quote('clear:'+source)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)
    cleared=result.returncode==0
  status(status='watching' ,mode='send' if args.send else 'dry-run',busy=bool(child))
 except (sqlite3.Error,OSError,subprocess.TimeoutExpired) as e:
  status(status='blocked',reason=type(e).__name__,detail=str(e))
  time.sleep(1)
 watch.wait(min(1 if child else 30,max(0,end-time.monotonic())))
