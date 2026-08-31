export const MAX_OFFLINE_SESSION_MS = 24 * 60 * 60 * 1000

export function sessionValidatedAt(session) {
  return Number(session?.lastValidatedAt || session?.createdAt || 0)
}

export function isOfflineSessionFresh(session, now = Date.now()) {
  const validatedAt = sessionValidatedAt(session)
  return Boolean(validatedAt) && now - validatedAt <= MAX_OFFLINE_SESSION_MS
}

export function markSessionValidated(session, now = Date.now()) {
  return { ...session, lastValidatedAt: now }
}

export function assertSensitiveActionOnline(label = 'Questa operazione') {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const error = new Error(`${label} richiede una connessione internet per verificare permessi e sessione.`)
    error.code = 'ONLINE_REQUIRED'
    throw error
  }
}
