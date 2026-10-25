"""Check local documentation links, assets, anchors, and translation coverage."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SKIP = {'.git', 'node_modules', 'dist', '.venv', 'vendor', 'backup'}

def prose(text):
    return re.sub(r'^```.*?^```\s*$', '', text, flags=re.M | re.S)

def anchors(text):
    result = set(re.findall(r'<a\s+[^>]*id=["\']([^"\']+)', text))
    counts = {}
    for heading in re.findall(r'^#{1,6}\s+(.+?)\s*#*$', prose(text), re.M):
        heading = re.sub(r'<[^>]*>', '', heading).lower()
        heading = re.sub(r'[^\w\-\s]', '', heading).replace(' ', '-')
        number = counts.get(heading, 0)
        counts[heading] = number + 1
        result.add(heading + (f'-{number}' if number else ''))
    return result

def main():
    errors = []
    documents = [p for p in ROOT.rglob('*.md') if not SKIP.intersection(p.relative_to(ROOT).parts)]
    links = 0
    for doc in documents:
        text = prose(doc.read_text())
        targets = re.findall(r'\]\(([^\s)]+)(?:\s+"[^"]*")?\)', text)
        targets += re.findall(r'(?:src|srcset)="([^" ]+)"', text)
        for raw in targets:
            url = urlsplit(raw.strip('<>'))
            if url.scheme or url.netloc:
                continue
            target = (doc.parent / unquote(url.path)).resolve() if url.path else doc
            links += 1
            if not target.exists():
                errors.append(f'{doc.relative_to(ROOT)}: missing {raw}')
            elif url.fragment and target.suffix == '.md' and unquote(url.fragment) not in anchors(target.read_text()):
                errors.append(f'{doc.relative_to(ROOT)}: missing anchor {raw}')
    pairs = [(p, ROOT/'docs/zh-CN'/p.name) for p in (ROOT/'docs').glob('*.md')]
    pairs += [(ROOT/p, ROOT/p.replace('.md', '.zh-CN.md')) for p in ['README.md','CONTRIBUTING.md','SECURITY.md','THIRD_PARTY.md','re/README.md','docs/screenshots/README.md','web/assets/concert/README.md']]
    for source, translation in pairs:
        if not translation.is_file():
            errors.append(f'{source.relative_to(ROOT)}: missing translation {translation.relative_to(ROOT)}')
    if errors:
        print('\n'.join(errors))
        return 1
    print(f'Checked {len(documents)} documents, {links} local links, and {len(pairs)} translation pairs.')
    return 0

if __name__ == '__main__':
    sys.exit(main())
