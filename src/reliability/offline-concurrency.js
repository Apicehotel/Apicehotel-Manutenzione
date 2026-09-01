const uuid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`

export const OFFLINE_LEASE_MS = 90_000
export const OFFLINE_BACKOFF_STEPS = Object.freeze([5_000, 15_000, 30_000, 60_000, 120_000, 300_000])

export const createOfflineOperationId = () => `RND-OP-${uuid()}`
export const createOfflineLeaseOwner = () => `RND-LEASE-${uuid()}`

export function retryDelay(attempts = 0, random = Math.random) {
  const base = OFFLINE_BACKOFF_STEPS[Math.min(Math.max(Number(attempts) || 0, 0), OFFLINE_BACKOFF_STEPS.length - 1)]
  const jitter = 0.8 + (Math.min(Math.max(Number(random()) || 0, 0), 1) * 0.4)
  return Math.round(base * jitter)
}

export function canClaimOfflineOperation(op, { ownerId, now = Date.now() } = {}) {
  if (!op) return false
  if (Number(op.nextAttemptAt || 0) > now) return false
  const leaseUntil = Number(op.leaseUntil || 0)
  return !leaseUntil || leaseUntil <= now || op.leaseOwner === ownerId
}

export function withOfflineLease(op, ownerId, now = Date.now()) {
  if (!canClaimOfflineOperation(op, { ownerId, now })) return null
  return {
    ...op,
    leaseOwner: ownerId,
    leaseUntil: now + OFFLINE_LEASE_MS,
  }
}

export function clearOfflineLeasePatch() {
  return { leaseOwner: null, leaseUntil: 0 }
}
