from pathlib import Path

css = Path('src/randapp/shell.css')
s = css.read_text()
old = ".rs-toolbar { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; position: sticky; top: calc(var(--rs-header-h) + var(--rs-safe-top)); z-index: 10; padding-top: 4px; }"
new = """.rs-toolbar {
  display: flex;
  flex-direction: column;
  gap: clamp(10px, 2.4vw, 14px);
  margin: 0 0 clamp(18px, 3vw, 28px);
  padding-top: 4px;
  position: static;
  min-width: 0;
}

[data-testid='issues-view'] {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

[data-testid='issues-list'] {
  position: relative;
  z-index: 0;
  margin-top: 0;
  padding-bottom: clamp(88px, 14vh, 132px);
}

@media (min-width: 1024px) {
  [data-testid='issues-list'] {
    padding-bottom: 24px;
  }
}
"""
if old not in s:
    raise SystemExit('toolbar rule not found')
s = s.replace(old, new, 1)
s = s.replace('  [data-testid="issues-list"] {\n    margin-top: 8px;\n  }\n', '', 1)
css.write_text(s)
