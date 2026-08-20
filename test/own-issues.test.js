import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test("segnalatore/Portiere Notturno (solo create+read_own_hotel) vedono solo le proprie segnalazioni, non quelle dell'intera struttura", async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /const ownIssuesOnly = !permissions\.includes\('assign'\) && !permissions\.includes\('complete'\) && !permissions\.includes\('take_charge'\) && !permissions\.includes\('read_all_departments'\)/)
  assert.match(app, /const hotelIssues = useMemo\(\(\) => allIssues\.filter\(\(issue\) => issue\.hotelId === hotel\.id && \(!ownIssuesOnly \|\| issue\.createdByName === user\.name\)\), \[allIssues, hotel\.id, ownIssuesOnly, user\.name\]\)/)
  // Il conteggio degli stati e la lista Segnalazioni derivano entrambi da hotelIssues già filtrato,
  // non più da allIssues grezzo: il filtro si applica automaticamente ovunque, non solo alla lista.
  assert.match(app, /statusCounts = useMemo\(\(\) => hotelIssues\.reduce/)
  assert.match(app, /issues = useMemo\(\(\) => hotelIssues\.filter\(\(issue\) => issue\.status === status\)/)
  // L'export CSV rispetta lo stesso filtro, non bypassa più con allIssues non filtrato.
  assert.match(app, /exportIssuesCsv\(hotelIssues, hotel\)/)
})

test('ruoli con permessi di gestione (assign/complete/take_charge/read_all_departments) continuano a vedere tutte le segnalazioni della struttura', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  // Nessun filtro aggiuntivo per manutentore/Responsabile/Direzione/admin/Tecnico esterno:
  // ownIssuesOnly risulta false per loro perché hanno almeno uno di questi permessi.
  assert.doesNotMatch(app, /ownIssuesOnly = permissions\.includes/)
})
