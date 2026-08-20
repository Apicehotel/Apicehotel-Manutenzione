import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test("Planning Sale: si apre di default sulla settimana corrente intera (da lunedì) + quella successiva, 'Oggi' torna sempre al lunedì", async () => {
  const planning = await readFile(new URL('../src/planning.jsx', import.meta.url), 'utf8')
  assert.match(planning, /const mondayOf = \(value = new Date\(\)\) => \{ const date=startDay\(value\); const day=date\.getDay\(\); const diff=day===0\?-6:1-day; return addDays\(date,diff\) \}/)
  // CalendarControls: comportamento invariato per Planning Lavori (todayAnchor di default = startDay,
  // 'Oggi' resta ancorato al giorno stesso, non al lunedì) — solo Planning Sale usa mondayOf.
  assert.match(planning, /function CalendarControls\(\{ view, onView, anchor, onAnchor, todayAnchor = startDay \}\) \{/)
  assert.match(planning, /<button onClick=\{\(\)=>onAnchor\(todayAnchor\(\)\)\}>Oggi<\/button>/)
  // Planning Sale: vista di default 'quindicina' (2 settimane), ancorata al lunedì della settimana
  // corrente fin dall'apertura — non più alla vista 'settimana' che partiva da oggi in avanti.
  const saleSection = planning.slice(planning.indexOf('export function PlanningSale'))
  assert.match(saleSection, /const \[view,setView\]=useState\('quindicina'\)/)
  assert.match(saleSection, /const \[anchor,setAnchor\]=useState\(\(\)=>mondayOf\(\)\)/)
  assert.match(saleSection, /todayAnchor=\{mondayOf\}/)
  // Planning lavori non è stato toccato: resta ancorato a oggi, vista settimana di default.
  const workSection = planning.slice(planning.indexOf('export function PlanningWork'), planning.indexOf('export function PlanningSale'))
  assert.match(workSection, /const \[view,setView\]=useState\('settimana'\)/)
  assert.match(workSection, /const \[anchor,setAnchor\]=useState\(\(\)=>startDay\(\)\)/)
})
