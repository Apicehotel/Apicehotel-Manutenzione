from pathlib import Path
import re

root = Path('src/randapp')
patterns = {
    'position': re.compile(r'position\s*:\s*(fixed|sticky|absolute)', re.I),
    'negative-margin': re.compile(r'margin(?:-[a-z]+)?\s*:\s*-', re.I),
    'negative-transform': re.compile(r'translate[XY]?\(\s*-', re.I),
    'overflow-hidden': re.compile(r'overflow(?:-[xy])?\s*:\s*hidden', re.I),
    'viewport-height': re.compile(r'\b(?:height|min-height|max-height)\s*:\s*[^;]*(?:100vh|100dvh|100svh)', re.I),
    'hard-height': re.compile(r'\bheight\s*:\s*(?:[4-9]\d|\d{3,})px', re.I),
}
for path in sorted(root.rglob('*')):
    if path.suffix not in {'.css', '.jsx', '.js'}:
        continue
    text = path.read_text(errors='ignore')
    for i, line in enumerate(text.splitlines(), 1):
        hits = [name for name, rx in patterns.items() if rx.search(line)]
        if hits:
            print(f'{path}:{i}: [{",".join(hits)}] {line.strip()}')
