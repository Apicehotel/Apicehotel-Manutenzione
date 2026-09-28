import { IMPLEMENTED_REPOSITORIES, RepositoryUpdateStatus } from './repository-registry.js'

export async function checkImplementedRepositoryUpdates({ fetchImpl = globalThis.fetch, repositories = IMPLEMENTED_REPOSITORIES } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required')

  return Promise.all(repositories.map(async (item) => {
    if (item.tracking === 'managed-here') {
      return { ...item, status: RepositoryUpdateStatus.MANAGED_HERE, latestSha: null, checkedAt: new Date().toISOString() }
    }

    try {
      const response = await fetchImpl(`https://api.github.com/repos/${item.repository}/commits?per_page=1`, {
        headers: { Accept: 'application/vnd.github+json' },
      })
      if (!response.ok) throw new Error(`GitHub ${response.status}`)
      const payload = await response.json()
      const latest = Array.isArray(payload) ? payload[0] : null
      const latestSha = latest?.sha || null
      return {
        ...item,
        status: latestSha && item.trackedSha && latestSha !== item.trackedSha
          ? RepositoryUpdateStatus.UPDATE_AVAILABLE
          : RepositoryUpdateStatus.CURRENT,
        latestSha,
        latestCommitUrl: latest?.html_url || null,
        latestCommitDate: latest?.commit?.committer?.date || latest?.commit?.author?.date || null,
        checkedAt: new Date().toISOString(),
      }
    } catch (error) {
      return {
        ...item,
        status: RepositoryUpdateStatus.CHECK_FAILED,
        latestSha: null,
        error: error?.message || String(error),
        checkedAt: new Date().toISOString(),
      }
    }
  }))
}
