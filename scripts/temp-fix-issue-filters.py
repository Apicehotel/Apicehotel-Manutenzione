from pathlib import Path

issues = Path('src/randapp/Issues.jsx')
s = issues.read_text()
old = """        <Segmented value={filter} onChange={setFilter}\n          options={FILTERS.map(([k, l]) => [k, l, k === 'all' ? issues.length : (counts[k] || 0)])} />"""
new = """        <div className=\"rs-issue-filter-scroll\" data-testid=\"issue-filters\">\n          <Segmented value={filter} onChange={setFilter}\n            options={FILTERS.map(([k, l]) => [k, l, k === 'all' ? issues.length : (counts[k] || 0)])} />\n        </div>"""
if old not in s:
    raise SystemExit('Segmented filter block not found')
issues.write_text(s.replace(old, new, 1))

css = Path('src/randapp/shell.css')
c = css.read_text()
marker = '/* issue filters responsive */'
block = '''\n\n/* issue filters responsive */\n.rs-issue-filter-scroll {\n  position: relative;\n  min-width: 0;\n  width: 100%;\n}\n\n.rs-issue-filter-scroll > .rs-segmented {\n  width: 100%;\n}\n\n@media (max-width: 720px) {\n  .rs-toolbar {\n    gap: 10px;\n    margin-bottom: 14px;\n  }\n\n  .rs-issue-filter-scroll {\n    overflow-x: auto;\n    overflow-y: hidden;\n    -webkit-overflow-scrolling: touch;\n    scrollbar-width: none;\n    overscroll-behavior-x: contain;\n    scroll-snap-type: x proximity;\n    padding: 2px 18px 4px 0;\n  }\n\n  .rs-issue-filter-scroll::-webkit-scrollbar { display: none; }\n\n  .rs-issue-filter-scroll > .rs-segmented {\n    width: max-content;\n    min-width: 100%;\n    display: inline-flex;\n    flex-wrap: nowrap;\n    gap: 6px;\n    padding: 4px;\n  }\n\n  .rs-issue-filter-scroll > .rs-segmented > button {\n    flex: 0 0 auto;\n    min-width: max-content;\n    white-space: nowrap;\n    scroll-snap-align: start;\n    padding-inline: 13px;\n  }\n\n  [data-testid=\"issues-list\"] { margin-top: 2px; }\n}\n\n@media (min-width: 721px) {\n  .rs-issue-filter-scroll > .rs-segmented {\n    display: grid;\n    grid-auto-flow: column;\n    grid-auto-columns: minmax(max-content, 1fr);\n  }\n}\n'''
if marker not in c:
    css.write_text(c.rstrip() + block + '\n')
