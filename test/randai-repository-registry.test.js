import test from 'node:test'
import assert from 'node:assert/strict'
import { checkImplementedRepositoryUpdates } from '../src/randai/software/repository-updates.js'
import { RepositoryUpdateStatus } from '../src/randai/software/repository-registry.js'

test('repository registry detects upstream changes without polling', async () => {
  const repositories = [
    { id: 'x', repository: 'owner/repo', tracking: 'commit', trackedSha: 'old' },
    { id: 'self', repository: 'owner/self', tracking: 'managed-here', trackedSha: null },
  ]
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return {
      ok: true,
      async json() {
        return [{ sha: 'new', html_url: 'https://github.com/owner/repo/commit/new', commit: { committer: { date: '2026-09-28T00:00:00Z' } } }]
      },
    }
  }

  const result = await checkImplementedRepositoryUpdates({ fetchImpl, repositories })
  assert.equal(calls, 1)
  assert.equal(result[0].status, RepositoryUpdateStatus.UPDATE_AVAILABLE)
  assert.equal(result[1].status, RepositoryUpdateStatus.MANAGED_HERE)
})
