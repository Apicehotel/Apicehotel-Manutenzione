import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { validateRandSkills } from '../scripts/validate-randskills.mjs'

test('RandSkills v1 manifests are valid and complete', () => {
  const result = validateRandSkills()
  assert.equal(result.ok, true, result.errors.join('\n'))
  assert.deepEqual(result.skills, [
    'housekeeping',
    'maintenance',
    'planning',
    'procedures',
    'repo-radar',
    'warehouse',
    'whatsapp',
  ])
})

test('Node toolchain contract is pinned and fail-closed', () => {
  const nvmrc = fs.readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim()
  const npmrc = fs.readFileSync(new URL('../.npmrc', import.meta.url), 'utf8')
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(nvmrc, '24.15.0')
  assert.equal(pkg.engines.node, '24.15.0')
  assert.match(npmrc, /^engine-strict=true/m)
})

test('RandSkills architecture keeps RandCore as authorization authority', () => {
  const doc = fs.readFileSync(new URL('../docs/architecture/RANDSKILLS_V1.md', import.meta.url), 'utf8')
  assert.match(doc, /RandCore resta l'autorità/)
  assert.match(doc, /non una dipendenza centrale/)
})
