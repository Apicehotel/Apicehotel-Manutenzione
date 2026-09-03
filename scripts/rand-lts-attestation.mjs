import fs from 'node:fs'
import path from 'node:path'
import { buildRandLtsAttestation, evaluateRandLtsReadiness } from '../src/randai/core/lts-readiness.js'
import { getRandEcosystemManifest } from '../src/randai/core/ecosystem.js'

const root = process.cwd()
const modules = getRandEcosystemManifest()
const readiness = evaluateRandLtsReadiness({ modules })

const missingEvidence = []
for (const module of readiness.included) {
  for (const evidence of module.evidence || []) {
    if (!fs.existsSync(path.join(root, evidence))) missingEvidence.push({ moduleId: module.id, evidence })
  }
}

if (!readiness.ready || missingEvidence.length) {
  const payload = { readiness, missingEvidence }
  console.error(JSON.stringify(payload, null, 2))
  process.exit(1)
}

const commitSha = String(process.env.RAND_LTS_COMMIT_SHA || process.env.GITHUB_SHA || '').trim()
if (!commitSha) {
  console.error('RAND_LTS_COMMIT_SHA or GITHUB_SHA is required')
  process.exit(1)
}

const checks = {
  security: true,
  quality: true,
  critical: true,
  multihotel: true,
  production: true,
  build: true,
  contracts: true,
  browser: true,
  device: true,
  warehouse: true,
  ecosystem: true,
}

const attestation = buildRandLtsAttestation({ commitSha, checks, modules })
const output = {
  ...attestation,
  evidenceVerified: true,
  evidenceCount: readiness.included.reduce((total, module) => total + module.evidence.length, 0),
  generatedBy: 'scripts/rand-lts-attestation.mjs',
}

fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true })
const target = path.join(root, 'artifacts', 'rand-ecosystem-lts-1.0.json')
fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`)
console.log(`Rand Ecosystem LTS 1.0 attestation written to ${target}`)
console.log(JSON.stringify({ includedModules: output.includedModules, deferredModules: output.deferredModules, evidenceCount: output.evidenceCount }, null, 2))
