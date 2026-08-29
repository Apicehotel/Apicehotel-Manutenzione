import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const manifestPath = path.join(root, '.agents', 'skills.lock.json')
const projectSkillPath = path.join(root, '.agents', 'skills', 'randapp-quality-gate', 'SKILL.md')
const packagePath = path.join(root, 'package.json')

for (const file of [manifestPath, projectSkillPath, packagePath]) {
  if (!fs.existsSync(file)) throw new Error(`Agent toolchain: file mancante ${path.relative(root, file)}`)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
const skill = fs.readFileSync(projectSkillPath, 'utf8')

if (manifest.schemaVersion !== 1) throw new Error('Agent toolchain: schemaVersion non supportata')
if (!Array.isArray(manifest.core) || manifest.core.length < 10) throw new Error('Agent toolchain: selezione core incompleta')
if (!manifest.policy?.officialSourcesOnly) throw new Error('Agent toolchain: officialSourcesOnly deve essere true')
if (manifest.policy?.installAll !== false) throw new Error('Agent toolchain: installAll deve essere false')

const ids = manifest.core.map((item) => item.id)
if (new Set(ids).size !== ids.length) throw new Error('Agent toolchain: skill core duplicate')

const required = [
  'supabase/postgres-best-practices',
  'openai/security-threat-model',
  'openai/security-best-practices',
  'openai/playwright',
  'trailofbits/audit-context-building',
  'trailofbits/differential-review',
  'trailofbits/static-analysis',
  'addyosmani/web-quality-audit',
  'addyosmani/accessibility',
  'openai/gh-fix-ci',
]
for (const id of required) if (!ids.includes(id)) throw new Error(`Agent toolchain: skill core mancante ${id}`)

for (const item of manifest.core) {
  if (!item.id || !Array.isArray(item.stage) || item.stage.length === 0) throw new Error(`Agent toolchain: voce invalida ${JSON.stringify(item)}`)
  if (!item.official && !item.source) throw new Error(`Agent toolchain: fonte mancante ${item.id}`)
}

for (const dependency of manifest.runtimeAlreadyPresent || []) {
  const found = pkg.dependencies?.[dependency] || pkg.devDependencies?.[dependency]
  if (!found) throw new Error(`Agent toolchain: runtime dichiarato presente ma assente da package.json: ${dependency}`)
}

for (const marker of ['Multi-hotel isolation', 'Offline / chaos', 'Production gate', 'Supabase RLS']) {
  if (!skill.includes(marker)) throw new Error(`Agent toolchain: quality gate incompleto, manca ${marker}`)
}

console.log(`Agent toolchain OK: ${manifest.core.length} skill core, ${manifest.optional?.length || 0} opzionali, quality gate RandApp presente`)
