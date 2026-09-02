import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { contextualAddActionIds, LOCAL_CREATE_VIEWS } from '../src/randapp/contextual-add.js'
import { canManageTechnicianDirectory } from '../src/randapp/technician-directory-policy.js'

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

test('single-purpose pages route the plus directly', () => {
  assert.deepEqual(contextualAddActionIds('issues', all), ['issue'])
  assert.deepEqual(contextualAddActionIds('urgent', all), ['urgent'])
  assert.deepEqual(contextualAddActionIds('interventions', all), ['planning-work'])
  assert.deepEqual(contextualAddActionIds('my-work', all), ['planning-work'])
  assert.deepEqual(contextualAddActionIds('technicians', all), ['technician'])
})

test('planning exposes only allowed planning actions', () => {
  assert.deepEqual(contextualAddActionIds('planning-work', all), ['planning-work', 'planning-sale'])
  assert.deepEqual(contextualAddActionIds('planning-work', { ...all, 'planning-sale': false }), ['planning-work'])
})

test('local composer and read-only pages do not get a misleading global plus', () => {
  for (const view of LOCAL_CREATE_VIEWS) assert.deepEqual(contextualAddActionIds(view, all), [], view)
})

test('capabilities can remove contextual actions', () => {
  assert.deepEqual(contextualAddActionIds('issues', { ...all, issue: false }), [])
  assert.deepEqual(contextualAddActionIds('technicians', { ...all, technician: false }), [])
})

test('technician directory UI matches Point 4 manager roles', () => {
  for (const role of ['Direzione', 'Direttore Centro Congressi', 'Reception', 'admin']) assert.equal(canManageTechnicianDirectory({ role }), true, role)
  for (const role of ['manutentore', 'Tecnico esterno', 'Supremo', 'Governante']) assert.equal(canManageTechnicianDirectory({ role }), false, role)
})

test('shell uses contextual router instead of old global insert menu', () => {
  const source = fs.readFileSync(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
  assert.equal(source.includes('contextualAddActions'), true)
  assert.equal(source.includes('actionIds={contextualActionIds}'), true)
  assert.equal(source.includes('canManageTechnicianDirectory'), true)
  assert.equal(source.includes('setTechnicianCreateSignal'), true)
  assert.equal(source.includes('Object.values(insertAllowed)'), false)
})

test('technician directory uses canonical tables and controlled RPCs', () => {
  const source = fs.readFileSync(new URL('../src/randapp/operations/UtilityLightViews.jsx', import.meta.url), 'utf8')
  assert.equal(source.includes('external_technicians'), true)
  assert.equal(source.includes('external_technician_competencies'), true)
  assert.equal(source.includes('technician_manage_directory'), true)
  assert.equal(source.includes('technician_set_competencies'), true)
  assert.equal(source.includes("String(draft.company || '').trim()"), true)
  assert.equal(source.includes("role==='Tecnico esterno'"), false)
})
