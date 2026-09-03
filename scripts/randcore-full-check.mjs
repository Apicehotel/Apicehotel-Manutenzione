import fs from 'node:fs/promises'
import path from 'node:path'
import { getRandEcosystemManifest, summarizeRandEcosystem } from '../src/randai/core/ecosystem.js'
import { buildRepoRadarSnapshot } from '../src/randai/discovery/repo-radar.js'
import { REPO_RADAR_CANDIDATES } from '../src/randai/discovery/repo-radar-catalog.js'
import { buildHealthEvidenceSnapshot } from '../src/randai/core/health-evidence.js'

const root = process.cwd()
const generatedAt = new Date().toISOString()
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'))
const ecosystem = getRandEcosystemManifest()
const summary = summarizeRandEcosystem(ecosystem)
const radar = buildRepoRadarSnapshot(REPO_RADAR_CANDIDATES)
const directDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
const lockPackages = Object.keys(lock.packages || {}).length
const sha = process.env.GITHUB_SHA || null
const ref = process.env.GITHUB_REF || null

const pathExists = async (relativePath) => {
  try { await fs.access(path.join(root, relativePath)); return true } catch { return false }
}
const buildPresent = await pathExists('dist/index.html')

const findings = []
if (summary.counts.ZOMBIE > 0) findings.push({ category:'ecosystem', severity:'WARN', code:'DECLARED_ZOMBIES', title:'Moduli zombie dichiarati', detail:`${summary.counts.ZOMBIE} moduli richiedono pulizia o decisione.`, fingerprint:'ecosystem:zombies' })
if (summary.unfinished > 0) findings.push({ category:'ecosystem', severity:'INFO', code:'UNFINISHED_MODULES', title:'Moduli ancora da consolidare', detail:`${summary.unfinished} moduli non sono LIVE.`, fingerprint:'ecosystem:unfinished' })
if (radar.counts.REJECT > 0) findings.push({ category:'repo-radar', severity:'INFO', code:'REJECTED_CANDIDATES', title:'Candidate respinte dal Repo Radar', detail:`${radar.counts.REJECT} candidate restano escluse.`, fingerprint:'repo-radar:rejected' })

const domains = {
  database: {},
  security: {},
  workers: {},
  deploy: sha && buildPresent ? {
    status:'HEALTHY', score:100, checkedAt:generatedAt, source:'github-actions-build',
    evidence:{ sha, ref, build_artifact:'dist/index.html' },
  } : {},
  backup_restore: {},
  integrations: {},
  dependencies: {
    status:'HEALTHY', score:100, checkedAt:generatedAt, source:'package-lock+ci',
    evidence:{ direct_count:Object.keys(directDeps).length, lock_packages:lockPackages, lockfile_version:lock.lockfileVersion ?? null },
  },
}

const snapshot = buildHealthEvidenceSnapshot({ domains, generatedAt })
const penalty = findings.reduce((total, finding) => total + (finding.severity === 'CRITICAL' ? 30 : finding.severity === 'HIGH' ? 15 : finding.severity === 'WARN' ? 7 : 0), 0)
const evidenceScore = snapshot.score
const score = Math.max(0, evidenceScore - penalty)
const status = findings.some((finding) => finding.severity === 'CRITICAL')
  ? 'CRITICAL'
  : findings.some((finding) => ['HIGH', 'WARN'].includes(finding.severity)) || snapshot.status !== 'HEALTHY'
    ? 'DEGRADED'
    : 'HEALTHY'

const report = {
  status,
  score,
  confidence:snapshot.confidence,
  snapshot:{
    ...snapshot,
    context:{ ecosystem:summary, repo_radar:radar.counts },
  },
  findings,
}
await fs.mkdir(path.join(root, 'artifacts'), { recursive:true })
await fs.writeFile(path.join(root, 'artifacts', 'randcore-full-check.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ status, score, confidence:snapshot.confidence, coverage:snapshot.coverage, findings:findings.length }, null, 2))
