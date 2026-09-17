const apiBase = 'https://api.github.com'

const nowIso = () => new Date().toISOString()

export async function inspectGitHubBranchProtection({
  repository,
  branch = 'main',
  token,
  fetchImpl = globalThis.fetch,
  checkedAt = nowIso(),
} = {}) {
  if (!repository || !branch) {
    return {
      status: 'UNKNOWN',
      score: 0,
      checkedAt,
      source: 'github-branch-api',
      evidence: { repository: repository || null, branch: branch || null, protected: null, reason: 'missing-repository-or-branch' },
    }
  }

  if (!token || typeof fetchImpl !== 'function') {
    return {
      status: 'UNKNOWN',
      score: 0,
      checkedAt,
      source: 'github-branch-api',
      evidence: { repository, branch, protected: null, reason: !token ? 'missing-token' : 'fetch-unavailable' },
    }
  }

  try {
    const response = await fetchImpl(`${apiBase}/repos/${repository}/branches/${encodeURIComponent(branch)}`, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
        'user-agent': 'randcore-governance-check',
      },
    })

    if (!response.ok) {
      return {
        status: 'UNKNOWN',
        score: 0,
        checkedAt,
        source: 'github-branch-api',
        evidence: { repository, branch, protected: null, reason: `github-http-${response.status}` },
      }
    }

    const payload = await response.json()
    const protectedBranch = payload?.protected === true
    return {
      status: protectedBranch ? 'HEALTHY' : 'DEGRADED',
      score: protectedBranch ? 100 : 35,
      checkedAt,
      source: 'github-branch-api',
      evidence: {
        repository,
        branch,
        protected: protectedBranch,
        protection_url: payload?.protection_url || null,
        commit_sha: payload?.commit?.sha || null,
      },
    }
  } catch (error) {
    return {
      status: 'UNKNOWN',
      score: 0,
      checkedAt,
      source: 'github-branch-api',
      evidence: { repository, branch, protected: null, reason: 'github-request-failed', error: String(error?.message || error) },
    }
  }
}

export function githubGovernanceFinding(result) {
  if (!result || result.status === 'HEALTHY') return null
  const evidence = result.evidence || {}

  if (result.status === 'DEGRADED' && evidence.protected === false) {
    return {
      category: 'security',
      severity: 'HIGH',
      code: 'MAIN_BRANCH_UNPROTECTED',
      title: 'Branch main non protetto lato GitHub',
      detail: `Il branch ${evidence.branch || 'main'} non risulta protetto: la policy PR + review non e garantita dal server GitHub.`,
      fingerprint: `security:github-branch-unprotected:${evidence.repository || 'repo'}:${evidence.branch || 'main'}`,
    }
  }

  return {
    category: 'security',
    severity: 'INFO',
    code: 'BRANCH_PROTECTION_CHECK_UNAVAILABLE',
    title: 'Verifica protezione branch non disponibile',
    detail: `RandCore non ha potuto verificare la protezione del branch ${evidence.branch || 'main'} (${evidence.reason || 'unknown'}).`,
    fingerprint: `security:github-branch-check-unavailable:${evidence.repository || 'repo'}:${evidence.branch || 'main'}`,
  }
}
