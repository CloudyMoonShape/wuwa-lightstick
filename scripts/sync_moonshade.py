"""Refresh the vendored web styles from a local MoonShade design-system checkout.

Usage: python scripts/sync_moonshade.py PROJECT_DIR SKILL_REFERENCES_DIR
Requires fonttools[woff] only when refreshing; ordinary builds need stdlib only.
"""
import importlib.util
import json
from pathlib import Path
import shutil
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

project, references = map(Path, sys.argv[1:3])
dest = Path(__file__).resolve().parents[1] / "web/moonshade"
dest.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location("tokens_css", references / "tokens_css.py")
compiler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compiler)
tokens = json.loads((project / "tokens.json").read_text())
# Only the two OFL web fonts; terminal / e-ink fonts are not distributed here.
tokens["type"]["fonts"] = [f for f in tokens["type"]["fonts"] if f["family"] in ("D-DIN", "D-DIN Exp")]
tokens["type"]["groups"] = [g for g in tokens["type"]["groups"] if any(s["name"].startswith("web-") for s in g["styles"])]
faces = []
renamed = {}
import base64
for face in tokens["type"]["fonts"]:
    font = TTFont(project / face["file"])
    opts = subset.Options()
    sub = subset.Subsetter(options=opts)
    chars = (list(range(32, 127)) if face["family"] == "D-DIN Exp"
             else list(map(ord, "0123456789ABCDEF.%x-")))
    sub.populate(unicodes=chars + [0x00b0, 0x00d7, 0x2013, 0x2014, 0x2212])
    sub.subset(font)
    # Subsets are modified fonts: rename the primary font to respect OFL RFNs.
    family = "Wuwa UI Expanded" if int(face["weight"]) == 700 else "Wuwa UI Readout"
    for platform, encoding, language in ((3, 1, 0x409), (1, 0, 0)):
        for name_id, value in ((1, family), (4, family), (6, family.replace(" ", "")), (16, family)):
            font["name"].setName(value, name_id, platform, encoding, language)
    font.flavor = "woff2"
    output = dest / (family.replace(" ", "-").lower() + ".woff2")
    font.save(output)
    renamed[face["family"]] = family
    data = base64.b64encode(output.read_bytes()).decode()
    faces.append(f'@font-face {{font-family:"{family}";src:url(data:font/woff2;base64,{data}) format("woff2");font-weight:{face["weight"]};font-style:normal;font-display:swap;unicode-range:U+0020-00FF,U+2013-2014,U+2212;}}')
# The CSS family name must not reuse the RFN either, so the stacks point at the renamed subsets.
for key, stack in tokens["type"]["families"].items():
    for old, new in renamed.items():
        stack = stack.replace(f'"{old}"', f'"{new}"')
    tokens["type"]["families"][key] = stack
themed, plain = compiler.collect(tokens)
dark = [(n, v["dark"]) for n, v in themed.items()]
light = [(n, v["light"]) for n, v in themed.items()]
css = "/* Generated MoonShade web tokens. Refresh with scripts/sync_moonshade.py. */\n"
css += "\n".join(faces) + "\n"
css += compiler.block(':root, [data-theme="dark"]', dark, scheme="dark")
css += compiler.block('[data-theme="light"]', light, scheme="light")
css += '@media (prefers-color-scheme:light) {\n' + compiler.block(':root:not([data-theme])', light, scheme="light") + '}\n'
css += compiler.block(':root', list(plain.items()) + compiler.type_vars(tokens))
css += "\n".join(compiler.type_classes(tokens)) + "\n"
(dest / "tokens.css").write_text(css)
shutil.copyfile(project / "components/bundle.css", dest / "bundle.css")
shutil.copyfile(project / "fonts/OFL-D-DIN.txt", dest / "OFL-D-DIN.txt")
print("Updated MoonShade web tokens, components and OFL font subsets.")
