from pathlib import Path

# shell.css — reserve FAB clearance globally and remove Issues-only compensation
p = Path('src/randapp/shell.css')
s = p.read_text()
s = s.replace("  --rs-nav-h: calc(68px * var(--rs-scale));\n  --rs-header-h: calc(62px * var(--rs-scale));", "  --rs-nav-h: calc(68px * var(--rs-scale));\n  --rs-fab-h: calc(58px * var(--rs-scale));\n  --rs-content-bottom-clearance: calc(var(--rs-nav-h) + var(--rs-safe-bottom) + var(--rs-fab-h) + 36px * var(--rs-scale));\n  --rs-header-h: calc(62px * var(--rs-scale));", 1)
s = s.replace("padding: calc(16px * var(--rs-scale)) calc(16px * var(--rs-scale)) calc(var(--rs-nav-h) + var(--rs-safe-bottom) + 20px * var(--rs-scale));", "padding: calc(16px * var(--rs-scale)) calc(16px * var(--rs-scale)) var(--rs-content-bottom-clearance);", 1)
s = s.replace("z-index: 45; width: calc(58px * var(--rs-scale)); height: calc(58px * var(--rs-scale));", "z-index: 45; width: var(--rs-fab-h); height: var(--rs-fab-h);", 1)
old = """[data-testid='issues-list'] {
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
new = """[data-testid='issues-list'] {
  position: relative;
  z-index: 0;
  margin-top: 0;
}
"""
if old not in s:
    raise SystemExit('Issues clearance block not found')
s = s.replace(old, new, 1)
p.write_text(s)

# Home.jsx — no negative gutter compensation on mobile
p = Path('src/randapp/Home.jsx')
s = p.read_text()
old = '.rs-widget-grid-shell{margin-inline:-2px;width:calc(100% + 4px)}'
new = '.rs-widget-grid-shell{margin-inline:0;width:100%}'
if old not in s:
    raise SystemExit('Home negative gutter rule not found')
p.write_text(s.replace(old, new, 1))

# insert-form.css — preview participates in normal flow
p = Path('src/randapp/insert-form.css')
s = p.read_text()
old = '.rs-form:has([data-testid="issue-title-input"])>.rs-field:has([data-testid="issue-title-input"])+.rs-fieldset .rs-photo-preview{position:absolute;width:34px;height:34px;object-fit:cover;border-radius:9px;right:12px;margin-top:-42px;pointer-events:none}'
new = '.rs-form:has([data-testid="issue-title-input"])>.rs-field:has([data-testid="issue-title-input"])+.rs-fieldset .rs-photo-preview{position:static;width:100%;height:auto;aspect-ratio:1/1;max-height:52px;object-fit:cover;border-radius:9px;margin:6px 0 0;pointer-events:none}'
if old not in s:
    raise SystemExit('Photo preview overlap rule not found')
p.write_text(s.replace(old, new, 1))

# Housekeeping alert — inline, never overlays the current screen
p = Path('src/randapp/housekeeping-alert.css')
s = p.read_text()
s = s.replace('.rs-hk-alert{position:fixed;z-index:1250;right:max(14px,env(safe-area-inset-right));bottom:calc(92px + env(safe-area-inset-bottom));width:min(360px,calc(100vw - 28px));', '.rs-hk-alert{position:relative;z-index:2;width:100%;margin:0 0 clamp(14px,2.5vw,22px);', 1)
s = s.replace('@media (min-width:900px){.rs-hk-alert{bottom:22px;right:22px}}\n', '@media (min-width:900px){.rs-hk-alert{max-width:560px;margin-left:auto}}\n', 1)
p.write_text(s)

# Housekeeping alert belongs inside Shell content, not outside the application flow
p = Path('src/main.jsx')
s = p.read_text()
s = s.replace("import HousekeepingCompletionAlerts from './randapp/HousekeepingCompletionAlerts.jsx'\n", '', 1)
s = s.replace("{technicianMatch ? <TechnicianPortal token={technicianMatch[1]} /> : <><App /><HousekeepingCompletionAlerts /></>}", "{technicianMatch ? <TechnicianPortal token={technicianMatch[1]} /> : <App />}", 1)
p.write_text(s)

p = Path('src/randapp/Shell.jsx')
s = p.read_text()
s = s.replace("import GlobalUrgentAlert from './GlobalUrgentAlert.jsx'\n", "import GlobalUrgentAlert from './GlobalUrgentAlert.jsx'\nimport HousekeepingCompletionAlerts from './HousekeepingCompletionAlerts.jsx'\n", 1)
s = s.replace('<main className="rs-content" data-testid="main-content">{renderView()}</main>', '<main className="rs-content" data-testid="main-content"><HousekeepingCompletionAlerts />{renderView()}</main>', 1)
p.write_text(s)
