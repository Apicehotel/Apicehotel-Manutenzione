/**
 * Network-wide recovery for a confirmed server-side future-issued JWT rejection.
 * This only retries safe GET/HEAD requests, never writes; no JWT validation bypass.
 * Supabase Auth endpoints are excluded to avoid recursive refresh.
 */
export function createJwtRecoveringFetch(baseFetch, getClient) {
  let refreshInFlight = null
  let lastWarning = 0
  const warn = () => {
    if (typeof window === 'undefined' || Date.now()-lastWarning < 10000) return
    lastWarning = Date.now()
    window.dispatchEvent(new Event('apice-jwt-clock-rejected'))
  }
  return async (input, init = {}) => {
    const response = await baseFetch(input, init)
    const url = typeof input === 'string' ? input : input?.url || String(input)
    const method = String(init?.method || input?.method || 'GET').toUpperCase()
    if (![400, 401, 403].includes(response.status) || /\/auth\/v1\//.test(url)) return response
    let body = ''
    try { body = await response.clone().text() } catch { return response }
    if (!/jwt\s+issued\s+(?:at\s+)?(?:the\s+)?future/i.test(body)) return response
    if (!['GET', 'HEAD'].includes(method) || /\/functions\/v1\//.test(url)) { warn(); return response }
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
      // The HTTP headers from the failed call may contain the stale Bearer token.
      const headers = new Headers(input instanceof Request ? input.headers : undefined)
      new Headers(init?.headers || {}).forEach((value, key) => headers.set(key, value))
      headers.set('authorization', `Bearer ${data.session.access_token}`)
      const retry = await baseFetch(input, { ...init, headers })
      if ([400,401,403].includes(retry.status)) { const payload = await retry.clone().text().catch(() => ''); if (/jwt\s+issued\s+(?:at\s+)?(?:the\s+)?future/i.test(payload)) warn() }
      return retry
    } catch {
      warn()
      return response
    }
  }
}
