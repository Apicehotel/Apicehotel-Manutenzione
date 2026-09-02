import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { contextualAddActionIds, LOCAL_CREATE_VIEWS } from '../src/randapp/contextual-add.js'

const all = {
  issue: true,
  urgent: true,
  'planning-work': true,
  'planning-sale': true,
  technician: true,
}

test('home keeps only top-level creation choices', () => {
  assert.deepEqual(contextualAddActionIds('home', all), ['issue', 'urgent', 'planning-work', 'planning-sale'])
})

test('single-purpose pages route the + directly', () => {
  assert.deepEqual(contextualAddActionIds('issues', all), ['issue'])
  assert.deepEqual(contextualAddActionIds('urgent', all), ['urgent'])
  assert.deepEqual(contextualAddActionIds('interventions', all), ['planning-work'])
  assert.deepEqual(contextualAddActionIds('my-work', all), ['planning-work'])
  assert.deepEqual(contextualAddActionIds('technicians', all), ['technician'])
})

test('planning exposes only planning actions and honors permissions', () => {
  assert.deepEqual(contextualAddActionIds('planning-work', all), ['planning-work', 'planning-sale'])
  assert.deepEqual(contextualAddActionIds('planning-work', { ...all, 'planning-sale': false }), ['planning-work'])
})

test('pages with their own creation UI or read-only semantics do not get a misleading global +', () => {
  for (const view of LOCAL_CREATE_VIEWS) assert.deepEqual(contextualAddActionIds(view, all), [], view)
  for (const view of ['inventory', 'supplies', 'reminders', 'housekeeping', 'temperature', 'plants', 'feedback', 'profile', 'manual']) {
    assert.equal(LOCAL_CREATE_VIEWS.has(view), true, view)
  }
})

test('capabilities can remove every contextual action', () => {
  assert.deepEqual(contextualAddActionIds('issues', { ...all, issue: false }), [])
  assert.deepEqual(contextualAddActionIds('technicians', { ...all, technician: false }), [])
})

test('shell uses the contextual router instead of the old global insertAllowed menu', () => {
  const source = fs.readFileSync(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
  assert.match(source, /contextualAddActionIds/)
  assert.match(source, /actionIds=\{contextualActionIds\}/)
  assert.match(source, /setTechnicianCreateSignal/)
  assert.doesNotMatch(source, /Object\.values\(insertAllowed\)/)
})

test('technician directory uses Point 4 canonical tables and controlled RPCs', () => {
  const source = fs.readFileSync(new URL('../src/randapp/operations/UtilityLightViews.jsx', import.meta.url), 'utf8')
  assert.match(source, /external_technicians/)
  assert.match(source, /external_technician_competencies/)
  assert.match(source, /technician_manage_directory/)
  assert.match(source, /technician_set_competencies/)
  assert.doesNotMatch(source, /role==='Tecnico esterno'/)
})
