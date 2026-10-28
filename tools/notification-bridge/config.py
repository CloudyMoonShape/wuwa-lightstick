"""Local configuration. Never commit the populated config file."""
import json,os
from pathlib import Path
CONFIG_PATH=Path(os.environ.get('RESONATOR_CONFIG',Path.home()/'.config/resonator-notify/config.json'))
CONFIG=json.loads(CONFIG_PATH.read_text())
ROOT=Path(CONFIG.get('state_dir',str(Path.home()/'.local/state/resonator-notify'))).expanduser()
ROOT.mkdir(parents=True,exist_ok=True,mode=0o700)
