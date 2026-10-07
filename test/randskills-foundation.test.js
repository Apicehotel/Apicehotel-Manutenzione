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
    'prompt-lookup',
    'repo-radar',
    'skill-lookup',
    'warehouse',
    'whatsapp',
  ])
})

test('Node toolchain contract pins CI while keeping deployment provider compatibility', () => {
  const nvmrc = fs.readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim()
  const npmrc = fs.readFileSync(new URL('../.npmrc', import.meta.url), 'utf8')
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(nvmrc, '24.20.0')
  assert.equal(pkg.engines.node, '24.x')
  assert.match(npmrc, /^engine-strict=true/m)
})

test('RandSkills architecture keeps RandCore as authorization authority', () => {
  const doc = fs.readFileSync(new URL('../docs/architecture/RANDSKILLS_V1.md', import.meta.url), 'utf8')
  assert.match(doc, /RandCore resta l'autorità/)
  assert.match(doc, /non una dipendenza centrale/)
})


test('external repository skill discovery finds nested SKILL.md instead of requiring repository root', async () => {
  const os = await import('node:os')
  const path = await import('node:path')
  const { findSkillManifests, skillPackagesFromRepository } = await import('../scripts/discover-skill-manifests.mjs')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'randskills-'))
  fs.mkdirSync(path.join(root, 'plugins', 'vendor', 'skills', 'coding'), { recursive: true })
  fs.writeFileSync(path.join(root, 'plugins', 'vendor', 'skills', 'coding', 'SKILL.md'), '# nested')
  assert.equal(findSkillManifests(root).length, 1)
  assert.equal(skillPackagesFromRepository(root)[0].relativeManifestPath, 'plugins/vendor/skills/coding/SKILL.md')
})
