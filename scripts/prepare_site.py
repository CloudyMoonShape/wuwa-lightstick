"""Build one self-contained controller HTML, plus optional documentation/SDK."""
from pathlib import Path
import gzip
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'dist'
COPY = ('color.js', 'sdk.js', 'principles.html', '_headers', '_routes.json', '404.html', 'LICENSE.txt')

def inline_styles(html, controller=False):
    """Only inline known local CSS. Fonts in tokens.css are small data URIs."""
    def include(match):
        name = match.group(1)
        if name not in ('style.css', 'moonshade/tokens.css', 'moonshade/bundle.css'):
            raise SystemExit('Unexpected stylesheet: ' + name)
        css = (ROOT / 'web' / name).read_text()
        if controller and name == 'moonshade/tokens.css':
            # The controller title is Chinese; it never uses the Latin display face.
            css = re.sub(r'@font-face\s*\{font-family:"Wuwa UI Expanded";[^}]+\}', '', css)
        css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
        css = re.sub(r'\s+', ' ', css)
        return '<style>' + css.strip() + '</style>'
    return re.sub(r'<link rel="stylesheet" href="([^"]+)">', include, html)

def main():
    for name in ('index.html', 'app.js', 'visitors.js', 'style.css', *COPY):
        if not (ROOT / 'web' / name).is_file():
            raise SystemExit('Missing public asset: ' + name)
    html = (ROOT / 'web/index.html').read_text()
    sdk = (ROOT / 'web/sdk.js').read_text()
    app = (ROOT / 'web/app.js').read_text()
    sdk = re.sub(r'^export ', '', sdk, flags=re.M)
    color = re.sub(r'^export ', '', (ROOT / 'web/color.js').read_text(), flags=re.M)
    app, color_imports = re.subn(r'^import \{ rgbToHsv, wheelRgb, renderColor \} from "\./color.js";\s*', '', app, flags=re.M)
    if color_imports != 1: raise SystemExit('Color import changed')
    app, imports = re.subn(r'^import \{ LightstickClient \} from "\./sdk.js";\s*', '', app)
    if imports != 1:
        raise SystemExit('SDK import changed: inspect bundle before publishing')
    html = inline_styles(html, controller=True)
    html, scripts = re.subn(r'<script type="module" src="app.js"></script>', lambda _: '<script type="module">\n' + sdk + '\n' + color + '\n' + app + '\n</script>', html)
    if scripts != 1:
        raise SystemExit('Controller asset tags changed: inspect bundle')
    visitors = (ROOT / 'web/visitors.js').read_text()
    html, counters = re.subn(r'<script type="module" src="visitors.js"></script>', lambda _: '<script type="module">\n' + visitors + '\n</script>', html)
    if counters != 1:
        raise SystemExit('Visitor counter asset tag changed: inspect bundle')
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir()
    (DEST / 'index.html').write_text(html)
    for name in COPY:
        shutil.copy2(ROOT / 'web' / name, DEST / name)
    (DEST / 'principles.html').write_text(inline_styles((ROOT / 'web/principles.html').read_text()))
    (DEST / '404.html').write_text(inline_styles((ROOT / 'web/404.html').read_text(), controller=True))
    # Public assets only. Never copy source environments or hardware dumps.
    if (ROOT / 'web/assets/hardware').exists():
        shutil.copytree(ROOT / 'web/assets/hardware', DEST / 'assets/hardware')
    (DEST / 'moonshade').mkdir()
    shutil.copy2(ROOT / 'web/moonshade/OFL-D-DIN.txt', DEST / 'moonshade/OFL-D-DIN.txt')
    raw = html.encode()
    print(f'Controller: {len(raw):,} bytes raw; {len(gzip.compress(raw)):,} bytes gzip estimate; no external script/style/assets')
    print('Prepared dist/: index.html, ' + ', '.join(COPY))

if __name__ == '__main__':
    main()
