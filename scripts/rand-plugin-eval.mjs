import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = process.argv.slice(2)
const mode = args[0] || 'analyze'
const policyPath = path.join(root, 'evals', 'randai', 'plugin-eval-policy.json')

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function analyze() {
  const policy = loadJson(policyPath)
  const findings = []
  const required = new Set(['security','hotelIsolation','permissions','correctness','regression','cost','maintainability','rollback'])

  for (const dimension of required) {
    if (!policy.requiredDimensions?.includes(dimension)) findings.push({ severity: 'critical', dimension, message: `Missing required dimension: ${dimension}` })
  }
  for (const evidence of policy.evidence || []) {
    if (!fs.existsSync(path.join(root, evidence))) findings.push({ severity: 'critical', dimension: 'regression', message: `Missing evidence source: ${evidence}` })
  }
  if (policy.engine !== 'Promptfoo') findings.push({ severity: 'critical', dimension: 'maintainability', message: 'Promptfoo must remain the canonical evaluator engine' })
  if (policy.mode !== 'ADAPT_PATTERN') findings.push({ severity: 'critical', dimension: 'maintainability', message: 'plugin-eval must remain pattern-only and must not become a second evaluator' })
  if (policy.promotion?.allowAutomaticProductionPromotion !== false) findings.push({ severity: 'critical', dimension: 'security', message: 'Automatic production promotion must stay disabled' })
  if (policy.promotion?.requireHumanReview !== true) findings.push({ severity: 'critical', dimension: 'security', message: 'Human review is required before promotion' })

  const order = new Map((policy.fixFirstOrder || []).map((name, index) => [name, index]))
  findings.sort((a, b) => (order.get(a.dimension) ?? 999) - (order.get(b.dimension) ?? 999))
  const critical = findings.filter((finding) => finding.severity === 'critical').length
  const result = {
    schemaVersion: '1.0.0',
    policyVersion: policy.version,
    evaluator: policy.engine,
    sourcePattern: policy.sourcePattern,
    disposition: policy.mode,
    status: critical === 0 ? 'PASS' : 'FAIL',
    criticalFindings: critical,
    fixFirst: findings,
    dimensions: policy.requiredDimensions,
    evidence: policy.evidence,
    promotionReady: critical === 0 && policy.promotion.requireHumanReview === true,
    productionAutoPromotion: false
  }

  const outDir = path.join(root, 'artifacts', 'rand-plugin-eval')
  ensureDir(outDir)
  fs.writeFileSync(path.join(outDir, 'latest.json'), `${JSON.stringify(result, null, 2)}\n`)
  const markdown = [
    '# Rand Plugin Evaluation',
    '',
    `- Status: **${result.status}**`,
    `- Evaluator: **${result.evaluator}**`,
    `- Pattern source: \`${result.sourcePattern}\``,
    `- Disposition: **${result.disposition}**`,
    `- Critical findings: **${result.criticalFindings}**`,
    `- Human review required: **yes**`,
    '',
    '## Fix First',
    '',
    ...(findings.length ? findings.map((finding) => `- [${finding.severity.toUpperCase()}] ${finding.dimension}: ${finding.message}`) : ['- No blocking findings.']),
    '',
    '## Evidence',
    '',
    ...(result.evidence || []).map((item) => `- \`${item}\``),
    ''
  ].join('\n')
  fs.writeFileSync(path.join(outDir, 'latest.md'), markdown)
  console.log(`Rand plugin eval ${result.status}: ${critical} critical finding(s)`)
  if (critical > (policy.promotion?.maxCriticalFindings ?? 0)) process.exitCode = 1
}

function compare() {
  const beforePath = args[1]
  const afterPath = args[2]
  if (!beforePath || !afterPath) throw new Error('Usage: node scripts/rand-plugin-eval.mjs compare <before.json> <after.json>')
  const before = loadJson(path.resolve(root, beforePath))
  const after = loadJson(path.resolve(root, afterPath))
  const delta = {
    before: before.status,
    after: after.status,
    criticalFindingsDelta: (after.criticalFindings ?? 0) - (before.criticalFindings ?? 0),
    improved: (after.criticalFindings ?? 0) < (before.criticalFindings ?? 0) || (before.status !== 'PASS' && after.status === 'PASS')
  }
  console.log(JSON.stringify(delta, null, 2))
}

if (mode === 'analyze') analyze()
else if (mode === 'compare') compare()
else throw new Error(`Unknown mode: ${mode}`)
