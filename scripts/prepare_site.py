"""Build one self-contained controller HTML, plus optional documentation/SDK."""
from pathlib import Path
import gzip
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'dist'
COPY = ('sdk.js', 'principles.html', '_headers', '404.html', 'LICENSE.txt')

def main():
    for name in ('index.html', 'app.js', 'style.css', *COPY):
        if not (ROOT / 'web' / name).is_file():
            raise SystemExit('Missing public asset: ' + name)
    html = (ROOT / 'web/index.html').read_text()
    style = (ROOT / 'web/style.css').read_text()
    sdk = (ROOT / 'web/sdk.js').read_text()
    app = (ROOT / 'web/app.js').read_text()
    sdk = re.sub(r'^export ', '', sdk, flags=re.M)
    app, imports = re.subn(r'^import \{ LightstickClient \} from "\./sdk.js";\s*', '', app)
    if imports != 1:
        raise SystemExit('SDK import changed: inspect bundle before publishing')
    html, styles = re.subn(r'<link rel="stylesheet" href="style.css">', lambda _: '<style>' + style + '</style>', html)
    html, scripts = re.subn(r'<script type="module" src="app.js"></script>', lambda _: '<script type="module">\n' + sdk + '\n' + app + '\n</script>', html)
    if styles != 1 or scripts != 1:
        raise SystemExit('Controller asset tags changed: inspect bundle')
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir()
    (DEST / 'index.html').write_text(html)
    for name in COPY:
        shutil.copy2(ROOT / 'web' / name, DEST / name)
    raw = html.encode()
    print(f'Controller: {len(raw):,} bytes raw; {len(gzip.compress(raw)):,} bytes gzip estimate; no external script/style/assets')
    print('Prepared dist/: index.html, ' + ', '.join(COPY))

if __name__ == '__main__':
    main()
