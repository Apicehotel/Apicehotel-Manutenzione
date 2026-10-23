import { FUTURE_JWT_RE, isJwtLoginGraceActive, settleFreshAccessToken } from './jwt-errors.js'

// Ocean's PostgREST edge can lag Auth by more than 40 seconds. Keep the
// recovery bounded, but long enough to cover the observed clock skew.
const FUTURE_JWT_RETRY_ATTEMPTS = 45
const FUTURE_JWT_RETRY_GAP_MS = 2000

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
    // Edge Functions authenticate themselves; do not escalate their JWT skew into a Shell logout.
    if (/\/functions\/v1\//.test(url)) return response
    // PostgREST can reject a stale access token with a plain 401 instead of
    // the PGRST303 body. Safe GETs can be retried after refreshing Auth.
    if (response.status !== 401 && !isFutureBody(body)) return response
    if (!['GET', 'HEAD'].includes(method)) { warn(); return response }
    const client = getClient?.()
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers || {}).forEach((value, key) => headers.set(key, value))
    const originalAuthorization = headers.get('authorization')
    const futureJwt = isFutureBody(body)
    let accessToken = originalAuthorization?.replace(/^Bearer\s+/i, '') || ''
    try {
    // For PGRST303, keep the already-issued token stable while PostgREST's
    // clock catches up. Refreshing here would mint an even newer token and
    // move the rejection window forward on every retry.
    if (!futureJwt || !accessToken) {
      if (!client?.auth) { warn(); return response }
      const { data: current, error: sessionError } = await client.auth.getSession()
      if (sessionError || !current?.session?.refresh_token) { warn(); return response }
      if (!refreshInFlight) {
        refreshInFlight = client.auth.refreshSession().finally(() => { refreshInFlight = null })
      }
      const { data, error } = await refreshInFlight
      if (error || !data?.session?.access_token) { warn(); return response }
      accessToken = data.session.access_token
      headers.set('authorization', `Bearer ${accessToken}`)
    }
      await settleFreshAccessToken(accessToken, sleep)
      // Rebuild the safe read from the URL. Passing a Request object together
      // with init headers is browser-dependent and can drop Authorization.
      const retryInput = url
      // A query-specific AbortSignal belongs to the failed attempt. Reusing it
      // would cancel the recovery request before PostgREST can accept the new
      // session token (especially when React Query timed out the first read).
      const { signal: _originalSignal, ...retryInit } = init || {}
      let retry = await baseFetch(retryInput, { ...retryInit, headers })
      // Auth and PostgREST can have a wider clock skew than the browser can
      // observe from the token itself. Keep retrying safe reads while the
      // server explicitly reports PGRST303; do not retry ordinary 401/403s.
      for (let attempt = 0; attempt < FUTURE_JWT_RETRY_ATTEMPTS; attempt += 1) {
        if (![400, 401, 403].includes(retry.status)) break
        const payload = await retry.clone().text().catch(() => '')
        // A plain 401 is also common during Auth/PostgREST propagation. Keep
        // the refreshed bearer for a short bounded window; never replay 403s
        // unless the body explicitly identifies the future-JWT condition.
        if (!isFutureBody(payload) && retry.status !== 401) break
        if (retry.status === 401 && attempt >= 2) break
        await sleep(FUTURE_JWT_RETRY_GAP_MS)
        retry = await baseFetch(retryInput, { ...retryInit, headers })
      }
      if ([400, 401, 403].includes(retry.status)) {
        const payload = await retry.clone().text().catch(() => '')
        if (isFutureBody(payload)) warn()
      }
      return retry
    } catch {
      warn()
      return response
    }
  }
}
