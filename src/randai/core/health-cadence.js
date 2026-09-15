const DEFAULT_MONTHLY_WINDOW_MS = 35 * 24 * 60 * 60 * 1000
const DUE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export const HealthCadenceState = Object.freeze({
  FRESH: 'FRESH',
  DUE_SOON: 'DUE_SOON',
  OVERDUE: 'OVERDUE',
  MISSING: 'MISSING',
})

export function evaluateMonthlyHealthCadence(latest, { now = new Date(), windowMs = DEFAULT_MONTHLY_WINDOW_MS } = {}) {
  const nowMs = new Date(now).getTime()
  const checkedAt = latest?.created_at || latest?.evaluated_at || latest?.checkedAt
  const checkedMs = checkedAt ? new Date(checkedAt).getTime() : Number.NaN
  if (!Number.isFinite(nowMs) || !Number.isFinite(checkedMs)) {
    return Object.freeze({ state: HealthCadenceState.MISSING, checkedAt: null, ageMs: null, daysSinceCheck: null, dueInDays: null, overdueDays: null })
  }
  const ageMs = Math.max(0, nowMs - checkedMs)
  const remainingMs = windowMs - ageMs
  const state = remainingMs < 0 ? HealthCadenceState.OVERDUE : remainingMs <= DUE_WINDOW_MS ? HealthCadenceState.DUE_SOON : HealthCadenceState.FRESH
  return Object.freeze({ state, checkedAt, ageMs, daysSinceCheck: Math.floor(ageMs / 86400000), dueInDays: Math.max(0, Math.ceil(remainingMs / 86400000)), overdueDays: Math.max(0, Math.ceil(-remainingMs / 86400000)) })
}

export function healthCadenceLabel(cadence) {
  if (cadence.state === HealthCadenceState.MISSING) return 'Mai eseguito'
  if (cadence.state === HealthCadenceState.OVERDUE) return `Scaduto da ${cadence.overdueDays} giorni`
  if (cadence.state === HealthCadenceState.DUE_SOON) return `In scadenza · ${cadence.dueInDays} giorni`
  return `Fresco · ${cadence.daysSinceCheck} giorni fa`
}
