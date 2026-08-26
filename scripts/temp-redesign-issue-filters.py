from pathlib import Path
p = Path('src/randapp/shell.css')
s = p.read_text()
start = s.find('/* issue filters responsive */')
if start == -1:
    raise SystemExit('responsive filter block not found')
end = s.find('\n@media (min-width: 721px)', start)
if end == -1:
    raise SystemExit('desktop filter block not found')
end2 = s.find('\n}', end)
if end2 == -1:
    raise SystemExit('desktop filter block end not found')
end2 += 3
new = r'''/* issue filters responsive */
.rs-issue-filter-scroll {
  min-width: 0;
  width: 100%;
}

.rs-issue-filter-scroll > .rs-segmented {
  width: 100%;
}

@media (max-width: 720px) {
  .rs-toolbar {
    gap: 10px;
    margin-bottom: 14px;
  }

  .rs-issue-filter-scroll {
    overflow: visible;
    padding: 0;
    margin: 0;
  }

  .rs-issue-filter-scroll > .rs-segmented {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 7px;
    width: 100%;
    padding: 0;
    background: transparent;
    border: 0;
  }

  .rs-issue-filter-scroll > .rs-segmented > button {
    min-width: 0;
    width: 100%;
    min-height: 44px;
    padding: 8px 10px;
    justify-content: center;
    white-space: nowrap;
    border-radius: 13px;
    border: 1px solid var(--rs-line);
    background: var(--rs-surface-2);
  }

  .rs-issue-filter-scroll > .rs-segmented > button:nth-child(-n+3) {
    grid-column: span 2;
  }

  .rs-issue-filter-scroll > .rs-segmented > button:nth-child(4),
  .rs-issue-filter-scroll > .rs-segmented > button:nth-child(5) {
    grid-column: span 3;
  }

  .rs-issue-filter-scroll > .rs-segmented > button.active {
    border-color: var(--rs-line-strong);
    background: rgba(34, 211, 238, .12);
    box-shadow: 0 0 0 1px rgba(34, 211, 238, .08) inset;
  }

  .rs-issue-filter-scroll .rs-segmented__count {
    flex: 0 0 auto;
    min-width: 22px;
    height: 22px;
    display: inline-grid;
    place-items: center;
    padding: 0 6px;
    border-radius: 999px;
    font-size: .7rem;
  }

  [data-testid="issues-list"] {
    margin-top: 8px;
  }
}

@media (max-width: 360px) {
  .rs-issue-filter-scroll > .rs-segmented {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .rs-issue-filter-scroll > .rs-segmented > button,
  .rs-issue-filter-scroll > .rs-segmented > button:nth-child(-n+3),
  .rs-issue-filter-scroll > .rs-segmented > button:nth-child(4),
  .rs-issue-filter-scroll > .rs-segmented > button:nth-child(5) {
    grid-column: auto;
  }

  .rs-issue-filter-scroll > .rs-segmented > button:last-child {
    grid-column: 1 / -1;
  }
}

@media (min-width: 721px) {
  .rs-issue-filter-scroll > .rs-segmented {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(max-content, 1fr);
  }
}
'''
p.write_text(s[:start] + new + s[end2:])
