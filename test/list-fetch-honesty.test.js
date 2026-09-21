import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const notice = fs.readFileSync(new URL('../src/randapp/ListFetchNotice.jsx', import.meta.url), 'utf8')
const issues = fs.readFileSync(new URL('../src/randapp/Issues.jsx', import.meta.url), 'utf8')
const interventions = fs.readFileSync(new URL('../src/randapp/operations/InterventionsView.jsx', import.meta.url), 'utf8')
const urgent = fs.readFileSync(new URL('../src/randapp/operations/UrgentView.jsx', import.meta.url), 'utf8')

test('ListFetchNotice distinguishes stale cache from empty offline/error', () => {
  assert.match(notice, /data-testid="list-fetch-notice"/)
  assert.match(notice, /state=\{state\}/)
  assert.match(notice, /compact=\{hasItems\}/)
  assert.match(notice, /Dati non aggiornati/)
  assert.match(notice, /Caricamento non riuscito/)
  assert.match(notice, /actionLabel="Riprova"/)
})

test('Issues threads fetch ok/offline and never treats failed fetch as empty-only', () => {
  assert.match(issues, /ListFetchNotice/)
  assert.match(issues, /setFetchOk\(result\.ok !== false\)/)
  assert.match(issues, /setFetchOffline\(Boolean\(result\.offline\)\)/)
  assert.match(issues, /!\(!fetchOk && !issues\.length\) && filtered\.length === 0/)
})

test('Interventions keep cache on failure and surface ListFetchNotice', () => {
  assert.match(interventions, /ListFetchNotice/)
  assert.match(interventions, /setFetchOk\(result\.ok !== false\)/)
  assert.match(interventions, /setFetchOffline\(Boolean\(result\.offline\)\)/)
  assert.doesNotMatch(interventions, /setItems\(\[\]\)/)
  assert.match(interventions, /showEmpty = !loading && !\(!fetchOk && !items\.length\) && !visible\.length/)
})

test('UrgentView keeps cache on failure and surfaces ListFetchNotice', () => {
  assert.match(urgent, /ListFetchNotice/)
  assert.match(urgent, /setFetchOk\(result\.ok!==false\)/)
  assert.match(urgent, /setFetchOffline\(Boolean\(result\.offline\)\)/)
  assert.doesNotMatch(urgent, /setItems\(\[\]\)/)
  assert.match(urgent, /showEmpty=!loading&&!\(!fetchOk&&!items\.length\)&&!items\.length/)
})
