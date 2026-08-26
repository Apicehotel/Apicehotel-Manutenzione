import { readFileSync, writeFileSync } from 'node:fs'

// Applica la spaziatura approvata nel mockup 2.
const path = 'src/randapp/Home.jsx'
let source = readFileSync(path, 'utf8')

const replacements = [
  [
    '.rs-widget-panel-title{position:absolute;top:12px;left:12px;font-size:.78rem;font-weight:800;line-height:1;color:var(--rs-text);white-space:nowrap}.is-editing .rs-widget-panel-title{top:48px}',
    '.rs-widget-panel-title{position:absolute;top:14px;left:12px;font-size:.78rem;font-weight:800;line-height:1;color:var(--rs-text);white-space:nowrap}.is-editing .rs-widget-panel-title{top:50px}',
  ],
  [
    '.rs-widget-weather{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-align:center!important;padding:12px!important}',
    '.rs-widget-weather{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-align:center!important;padding:36px 12px 12px!important}',
  ],
  [
    '.rs-widget-quick{display:flex;flex-direction:column;justify-content:center;gap:9px;padding:12px!important}',
    '.rs-widget-quick{display:flex;flex-direction:column;justify-content:center;gap:9px;padding:36px 12px 12px!important}',
  ],
  [
    '.rs-home-activity{margin-top:clamp(14px,2.4vw,22px)}',
    '.is-editing .rs-widget-weather,.is-editing .rs-widget-quick{padding-top:66px!important}.is-editing .rs-widget-weather{gap:4px}.is-editing .rs-widget-weather__icon{font-size:1.75rem}.rs-home-activity{margin-top:clamp(14px,2.4vw,22px)}',
  ],
]

for (const [from, to] of replacements) {
  if (!source.includes(from)) throw new Error(`Target non trovato: ${from.slice(0, 60)}`)
  source = source.replace(from, to)
}

writeFileSync(path, source)
