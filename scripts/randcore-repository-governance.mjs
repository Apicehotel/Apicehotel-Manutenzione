import fs from 'node:fs/promises'
import path from 'node:path'
import { classifyRepositoryGovernance } from '../src/randai/core/repository-governance.js'

const root = process.cwd()
const repository = process.env.GITHUB_REPOSITORY || 'Apicehotel/Apicehotel-Manutenzione'
const token = process.env.GITHUB_TOKEN || ''
const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com'
const headers = {
  accept: 'application/vnd.github+json',
  'user-agent': 'randcore-repository-governance-v1',
  'x-github-api-version': '2022-11-28',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
}

async function githubJson(pathname) {
  const response = await fetch(`${apiBase.replace(/\/$/, '')}${pathname}`, { headers, signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error(`github:${response.status}:${pathname}`)
  return response.json()
}

let branch = null
let rulesets = null
let fetchError = null
try {
  const encodedRepo = repository.split('/').map(encodeURIComponent).join('/')
  ;[branch, rulesets] = await Promise.all([
    githubJson(`/repos/${encodedRepo}/branches/main`),
    githubJson(`/repos/${encodedRepo}/rulesets`),
  ])
} catch (error) {
  fetchError = String(error?.message || error)
}

const result = classifyRepositoryGovernance({ branch, rulesets, repository })
const report = {
  schema: 'randcore.repository-governance.v1',
  generated_at: new Date().toISOString(),
  repository,
  ...result,
  evidence: {
    ...result.evidence,
    fetch_error: fetchError,
  },
}

await fs.mkdir(path.join(root, 'artifacts'), { recursive: true })
await fs.writeFile(path.join(root, 'artifacts', 'repository-governance.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ status: report.status, code: report.code, repository }, null, 2))
