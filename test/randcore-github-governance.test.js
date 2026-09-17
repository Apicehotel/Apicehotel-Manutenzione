import test from 'node:test'
import assert from 'node:assert/strict'
import { githubGovernanceFinding, inspectGitHubBranchProtection } from '../src/randai/core/github-governance.js'

const okResponse = (payload) => ({ ok: true, status: 200, json: async () => payload })

test('RandCore marks main healthy when GitHub reports the branch protected', async () => {
  const result = await inspectGitHubBranchProtection({
    repository: 'Apicehotel/Apicehotel-Manutenzione',
    branch: 'main',
    token: 'test-token',
    checkedAt: '2026-09-17T14:00:00.000Z',
    fetchImpl: async () => okResponse({ protected: true, commit: { sha: 'abc' } }),
  })

  assert.equal(result.status, 'HEALTHY')
  assert.equal(result.score, 100)
  assert.equal(result.evidence.protected, true)
  assert.equal(githubGovernanceFinding(result), null)
})

test('RandCore raises HIGH when main is not protected', async () => {
  const result = await inspectGitHubBranchProtection({
    repository: 'Apicehotel/Apicehotel-Manutenzione',
    branch: 'main',
    token: 'test-token',
    checkedAt: '2026-09-17T14:00:00.000Z',
    fetchImpl: async () => okResponse({ protected: false, commit: { sha: 'def' } }),
  })
  const finding = githubGovernanceFinding(result)

  assert.equal(result.status, 'DEGRADED')
  assert.equal(result.evidence.protected, false)
  assert.equal(finding.severity, 'HIGH')
  assert.equal(finding.code, 'MAIN_BRANCH_UNPROTECTED')
})

test('RandCore remains fail-informative when GitHub evidence cannot be queried', async () => {
  const result = await inspectGitHubBranchProtection({
    repository: 'Apicehotel/Apicehotel-Manutenzione',
    branch: 'main',
    token: null,
    checkedAt: '2026-09-17T14:00:00.000Z',
  })
  const finding = githubGovernanceFinding(result)

  assert.equal(result.status, 'UNKNOWN')
  assert.equal(result.evidence.reason, 'missing-token')
  assert.equal(finding.severity, 'INFO')
  assert.equal(finding.code, 'BRANCH_PROTECTION_CHECK_UNAVAILABLE')
})
