"""Run a manual source demo from the collector Mac."""
import shlex,subprocess,sys
from config import CONFIG
from trial import COLORS
if len(sys.argv)!=2 or sys.argv[1] not in COLORS:raise SystemExit('Usage: python3 demo.py '+ '|'.join(COLORS))
command=' '.join(shlex.quote(v) for v in [CONFIG['remote_python'],CONFIG['remote_send'],sys.argv[1]])
raise SystemExit(subprocess.call(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=5',CONFIG['ssh_host'],command]))
