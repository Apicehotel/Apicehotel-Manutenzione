import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Planning lavori usa i periodi degli interventi', async () => {
  const [source,app] = await Promise.all([readFile(new URL('../src/planning.jsx', import.meta.url), 'utf8'),readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')])
  assert.match(source, /function PlanningWork/)
  assert.match(source, /scheduledUntil/)
  assert.match(source, /Giorno/)
  assert.match(source, /Settimana/)
  assert.match(source, /Quindicina/)
  assert.match(app, /tab === 'Planning Lavori'/)
  assert.match(app, /tab === 'Planning Lavori' && canViewPlanningMenu\(user\)/)
  assert.match(app, />＋ Nuovo lavoro<\/button>/)
  assert.match(app, /operations theme-\$\{hotel\.tone\}/)
})

test('Planning Sale gestisce turni, combinazioni e conflitti', async () => {
  const source = await readFile(new URL('../src/planning.jsx', import.meta.url), 'utf8')
  assert.match(source, /function PlanningSale/)
  assert.match(source, /Trumpet 1\+2\+3\+4/)
  assert.match(source, /Sax 1\+2\+3/)
  assert.match(source, /Auditorium Intero/)
  assert.match(source, /Auditorium Tower 1/)
  assert.match(source, /Auditorium Tower 2/)
  assert.match(source, /\['auditorium-tower-1','auditorium-tower-2'\]/)
  assert.match(source, /saleConflict/)
  assert.match(source, /mattina/)
  assert.match(source, /pomeriggio/)
  assert.match(source, /tutto_giorno/)
  assert.match(source, /Nuova prenotazione/)
  assert.match(source, /dateFrom/)
  assert.match(source, /dateTo/)
  assert.match(source, /itemFrom<=dateTo&&itemTo>=dateFrom/)
  assert.match(source, /\['admin','Responsabile','Direttore Centro Congressi'\]/)
})

test('i due planning sono pagine dedicate accessibili dal menu hamburger', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /const tabs = \['Segnalazioni', \.\.\.\(canViewUrgent\(user\) \? \['Avvisi Urgenti'\] : \[\]\), \.\.\.\(canViewPlanned\(user\) \? \['Interventi'\] : \[\]\), \.\.\.\(canViewHousekeeping\(user\) \? \['Housekeeping'\] : \[\]\)\]/)
  assert.match(app, /const canViewPlanningMenu = \(user\) => \['manutentore','Direttore Centro Congressi'\]\.includes\(user\.role\)/)
  assert.match(app, /<span>Planning lavori<\/span>/)
  assert.match(app, /<span>Planning Sale<\/span>/)
  assert.match(app, /hotel\.id === 'hotelgio' && canViewPlanningMenu\(user\)/)
  assert.match(app, /className="planning-back"/)
  assert.match(app, /!isDedicatedPage && <nav className="tabs"/)
})
