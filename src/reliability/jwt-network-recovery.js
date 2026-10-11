import { FUTURE_JWT_RE, isJwtLoginGraceActive, settleFreshAccessToken } from './jwt-errors.js'

/**
 * Network-wide recovery for a confirmed server-side future-issued JWT rejection.
 * This only retries safe GET/HEAD requests, never writes; no JWT validation bypass.
 * Supabase Auth endpoints are excluded to avoid recursive refresh.
 */
export function createJwtRecoveringFetch(baseFetch, getClient, options = {}) {
  let refreshInFlight = null
  let lastWarning = 0
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  const warn = () => {
    // Right after PIN login the Shell is already settling REST; do not spam toasts.
    if (typeof window === 'undefined' || isJwtLoginGraceActive() || Date.now() - lastWarning < 10000) return
    lastWarning = Date.now()
    window.dispatchEvent(new Event('apice-jwt-clock-rejected'))
  }
  const isFutureBody = (body) => FUTURE_JWT_RE.test(String(body || ''))

  return async (input, init = {}) => {
    const response = await baseFetch(input, init)
    const url = typeof input === 'string' ? input : input?.url || String(input)
    const method = String(init?.method || input?.method || 'GET').toUpperCase()
    if (![400, 401, 403].includes(response.status) || /\/auth\/v1\//.test(url)) return response
    let body = ''
    try { body = await response.clone().text() } catch { return response }
    if (!isFutureBody(body)) return response
    // Edge Functions authenticate themselves; do not escalate their JWT skew into a Shell logout.
    if (/\/functions\/v1\//.test(url)) return response
    if (!['GET', 'HEAD'].includes(method)) { warn(); return response }
    const client = getClient?.()
    if (!client?.auth) { warn(); return response }
    try {
      const { data: current, error: sessionError } = await client.auth.getSession()
      if (sessionError || !current?.session?.refresh_token) { warn(); return response }
      if (!refreshInFlight) {
        refreshInFlight = client.auth.refreshSession().finally(() => { refreshInFlight = null })
      }
      const { data, error } = await refreshInFlight
      if (error || !data?.session?.access_token) { warn(); return response }
      await settleFreshAccessToken(data.session.access_token, sleep)
      // The HTTP headers from the failed call may contain the stale Bearer token.
      const headers = new Headers(input instanceof Request ? input.headers : undefined)
      new Headers(init?.headers || {}).forEach((value, key) => headers.set(key, value))
      headers.set('authorization', `Bearer ${data.session.access_token}`)
      let retry = await baseFetch(input, { ...init, headers })
      if ([400, 401, 403].includes(retry.status)) {
        const payload = await retry.clone().text().catch(() => '')
        if (isFutureBody(payload)) {
          // Small Auth/PostgREST skew can clear within a couple of seconds.
          await sleep(2000)
          retry = await baseFetch(input, { ...init, headers })
          if ([400, 401, 403].includes(retry.status)) {
            const again = await retry.clone().text().catch(() => '')
            if (isFutureBody(again)) warn()
          }
        }
      }
      return retry
    } catch {
      warn()
      return response
    }
  }
}
