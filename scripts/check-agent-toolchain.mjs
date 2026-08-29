import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const manifestPath = path.join(root, '.agents', 'skills.lock.json')
const projectSkillPath = path.join(root, '.agents', 'skills', 'randapp-quality-gate', 'SKILL.md')
const packagePath = path.join(root, 'package.json')
const installerPath = path.join(root, 'scripts', 'install-agent-skills.mjs')

for (const file of [manifestPath, projectSkillPath, packagePath, installerPath]) {
  if (!fs.existsSync(file)) throw new Error(`Agent toolchain: file mancante ${path.relative(root, file)}`)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
const skill = fs.readFileSync(projectSkillPath, 'utf8')
const installer = fs.readFileSync(installerPath, 'utf8')

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

const allowedSources = new Set([
  'https://github.com/supabase/agent-skills',
  'https://github.com/openai/skills',
  'https://github.com/trailofbits/skills',
  'https://github.com/addyosmani/web-quality-skills',
])

for (const item of manifest.core) {
  if (!item.id || !item.installSkill || !Array.isArray(item.stage) || item.stage.length === 0) {
    throw new Error(`Agent toolchain: voce invalida ${JSON.stringify(item)}`)
  }
  if (!allowedSources.has(item.source)) throw new Error(`Agent toolchain: fonte core non approvata ${item.id}: ${item.source}`)
  if (!installer.includes(item.installSkill)) throw new Error(`Agent toolchain: installer non include ${item.installSkill}`)
}

if (pkg.scripts?.['skills:install'] !== 'node scripts/install-agent-skills.mjs') {
  throw new Error('Agent toolchain: script skills:install mancante o inatteso')
}

for (const dependency of manifest.runtimeAlreadyPresent || []) {
  const found = pkg.dependencies?.[dependency] || pkg.devDependencies?.[dependency]
  if (!found) throw new Error(`Agent toolchain: runtime dichiarato presente ma assente da package.json: ${dependency}`)
}

for (const marker of ['Multi-hotel isolation', 'Offline / chaos', 'Production gate', 'Supabase RLS']) {
  if (!skill.includes(marker)) throw new Error(`Agent toolchain: quality gate incompleto, manca ${marker}`)
}

console.log(`Agent toolchain OK: ${manifest.core.length} skill core, ${manifest.optional?.length || 0} opzionali, fonti approvate e quality gate RandApp presenti`)
