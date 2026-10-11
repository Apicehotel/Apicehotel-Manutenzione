/**
 * Shared detection and user-facing copy for PostgREST "JWT issued at future"
 * (PGRST303) clock-skew failures. Never logs or mutates tokens.
 */

export const FUTURE_JWT_RE = /jwt\s+issued\s+(?:at\s+)?(?:the\s+)?future|pgrst303/i

export const isFutureJwtError = (error) =>
  FUTURE_JWT_RE.test(String(error?.message || error?.code || error || ''))

/** Shown only when Auth itself is dead and a new PIN login is required. */
export const JWT_CLOCK_USER_MESSAGE =
  'Sessione non allineata con il server. Controlla che data e ora del telefono siano automatiche, poi esci e accedi di nuovo con il PIN.'

export const JWT_LOGIN_GRACE_MS = 120000

export function humanizeJwtClockError(error) {
  const text = String(error?.message || error?.code || error || '')
  if (!FUTURE_JWT_RE.test(text) && !/orologio automatico|rinnovo sessione fallito|nessuna sessione supabase rinnovabile|sessione non allineata/i.test(text)) {
    return null
  }
  return JWT_CLOCK_USER_MESSAGE
}

export function readJwtIat(accessToken) {
  try {
    const part = String(accessToken || '').split('.')[1]
    if (!part) return null
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    const iat = Number(payload?.iat)
    return Number.isFinite(iat) ? iat : null
  } catch {
    return null
  }
}

/** Wait until local clock reaches token iat (capped), then a small settle buffer. */
export async function settleFreshAccessToken(accessToken, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
  const iat = readJwtIat(accessToken)
  if (!iat) return 0
  const waitMs = Math.min(Math.max(iat * 1000 - Date.now() + 400, 0), 8000)
  if (waitMs > 0) await sleep(waitMs)
  return waitMs
}

export function isJwtLoginGraceActive(now = Date.now()) {
  if (typeof sessionStorage === 'undefined') return false
  const loggedInAt = Number(sessionStorage.getItem('apice-jwt-login-at') || 0)
  return loggedInAt > 0 && now - loggedInAt < JWT_LOGIN_GRACE_MS
}

/**
 * Probe PostgREST until a freshly minted access token is accepted, or attempts run out.
 * Used after PIN login so the Shell does not boot on a token that REST still rejects.
 */
export async function waitUntilRestAcceptsAccessToken({
  accessToken,
  restUrl,
  anonKey,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  maxAttempts = 20,
} = {}) {
  if (!accessToken || !restUrl || !anonKey) return false
  const endpoint = `${String(restUrl).replace(/\/$/, '')}/rest/v1/hotels?select=id&limit=1`
  // Wait for local iat skew once; then poll PostgREST until Auth/API skew clears.
  await settleFreshAccessToken(accessToken, sleep)
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      })
      const body = await response.text()
      if (!FUTURE_JWT_RE.test(body)) return true
    } catch {
      /* best-effort probe */
    }
    if (attempt < maxAttempts - 1) await sleep(1000)
  }
  return false
}
