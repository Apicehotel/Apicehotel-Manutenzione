import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test("Planning: si apre su Oggi e il pulsante Oggi torna sempre alla vista giorno corrente", async () => {
  const planning = await readFile(new URL('../src/planning.jsx', import.meta.url), 'utf8')
  assert.match(planning, /function CalendarControls\(\{ view, onView, anchor, onAnchor, todayAnchor = startDay \}\) \{/)
  assert.match(planning, /const goToday = \(\) => \{ onView\('giorno'\); onAnchor\(todayAnchor\(\)\) \}/)
  assert.match(planning, /<button className=\{view==='giorno'\?'active':''\} onClick=\{goToday\}>Oggi<\/button>/)

  const workSection = planning.slice(planning.indexOf('export function PlanningWork'), planning.indexOf('export function PlanningSale'))
  assert.match(workSection, /const \[view,setView\]=useState\('giorno'\)/)
  assert.match(workSection, /const \[anchor,setAnchor\]=useState\(\(\)=>startDay\(\)\)/)

  const saleSection = planning.slice(planning.indexOf('export function PlanningSale'))
  assert.match(saleSection, /const \[view,setView\]=useState\('giorno'\)/)
  assert.match(saleSection, /const \[anchor,setAnchor\]=useState\(\(\)=>startDay\(\)\)/)
  assert.match(saleSection, /<CalendarControls view=\{view\} onView=\{setView\} anchor=\{anchor\} onAnchor=\{setAnchor\}\/>/)
})
