import Dexie from 'dexie'

const db = new Dexie('apiceOffline')
db.version(1).stores({
  cache: '&key,entity,hotelId,updatedAt',
  outbox: '++id,entity,hotelId,action,tempId,targetId,createdAt',
  idmap: '&tempId,realId',
})
db.version(2).stores({
  cache: '&key,entity,hotelId,updatedAt',
  outbox: '++id,entity,hotelId,action,tempId,targetId,createdAt',
  idmap: '&tempId,realId',
  blobs: '&id,createdAt',
})
db.version(3).stores({
  cache: '&key,entity,hotelId,updatedAt',
  outbox: '++id,entity,hotelId,action,tempId,targetId,createdAt',
  idmap: '&tempId,realId',
  blobs: '&id,createdAt',
  failures: '++id,entity,hotelId,action,tempId,targetId,failedAt',
})
db.version(4).stores({
  cache: '&key,entity,hotelId,updatedAt',
  outbox: '++id,entity,hotelId,action,tempId,targetId,createdAt',
  idmap: '&tempId,realId',
  blobs: '&id,createdAt',
  failures: '++id,entity,hotelId,action,tempId,targetId,failedAt',
  leases: '&key,owner,expiresAt',
})

const handlers = new Map()
let draining = false
let retryTimer = null
const onlineNow = () => typeof navigator === 'undefined' || navigator.onLine
const storageAvailable = () => typeof indexedDB !== 'undefined'
const cacheKey = (entity, hotelId) => `${entity}:${hotelId}`
const now = () => Date.now()
const uuid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
const BACKOFF_STEPS = [5000, 15000, 30000, 60000, 120000, 300000]
const OFFLINE_BLOB_PREFIX = 'offline-blob:'
const DRAIN_OWNER = uuid()
const DRAIN_LEASE_KEY = 'outbox-drain'
const DRAIN_LEASE_MS = 120000

const errorText = (error) => String(error?.message || error || '')
export const isTransientNetworkError = (error) => !onlineNow() || /failed to fetch|network|load failed|timeout|connection|temporarily|gateway|502|503|504/i.test(errorText(error))
const isPermanentError = (error) => error?.code === 'OFFLINE_CONFLICT' || /row level security|permission denied|forbidden|unauthorized|invalid input|not-null|not null|check constraint|violates.*constraint|unsupported/i.test(errorText(error))
const nextDelay = (attempts = 0) => BACKOFF_STEPS[Math.min(attempts, BACKOFF_STEPS.length - 1)]

function collectOfflineBlobIds(value, out = new Set(), seen = new Set()) {
  if (typeof value === 'string' && value.startsWith(OFFLINE_BLOB_PREFIX)) { out.add(value.slice(OFFLINE_BLOB_PREFIX.length)); return out }
  if (!value || typeof value !== 'object' || seen.has(value)) return out
  seen.add(value)
  if (Array.isArray(value)) value.forEach((item) => collectOfflineBlobIds(item, out, seen))
  else Object.values(value).forEach((item) => collectOfflineBlobIds(item, out, seen))
  return out
}
async function cleanupPayloadBlobs(oldPayload, keepPayload = null) {
  if (!storageAvailable() || !oldPayload) return
  const oldIds = collectOfflineBlobIds(oldPayload)
  const keepIds = collectOfflineBlobIds(keepPayload)
  const removable = [...oldIds].filter((id) => !keepIds.has(id))
  if (removable.length) await db.blobs.bulkDelete(removable)
}
function mergeQueuedPayload(previous = {}, next = {}) {
  const merged = { ...previous, ...next }
  const previousBase = previous?._syncBaseValues || null
  const nextBase = next?._syncBaseValues || null
  if (previousBase || nextBase) merged._syncBaseValues = { ...(nextBase || {}), ...(previousBase || {}) }
  if (previous?._syncBaseUpdatedAt || next?._syncBaseUpdatedAt) merged._syncBaseUpdatedAt = previous?._syncBaseUpdatedAt || next?._syncBaseUpdatedAt
  return merged
}
const nextRevision = (row) => Number(row?.revision || 1) + 1

const dispatchStatus = async () => {
  if (typeof window === 'undefined' || !storageAvailable()) return
  const [pending, blocked] = await Promise.all([db.outbox.count().catch(() => 0), db.failures.count().catch(() => 0)])
  window.dispatchEvent(new CustomEvent('apice-offline-status', { detail: { pending, blocked, online: onlineNow(), syncing: draining } }))
}
const dispatchDataChange = (entity, hotelId) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('apice-offline-data-changed', { detail: { entity, hotelId } }))
}
const scheduleDrain = (delay = 0) => {
  if (typeof window === 'undefined' || !storageAvailable() || !onlineNow()) return
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(() => { retryTimer = null; drainOfflineQueue() }, Math.max(0, delay))
}

export const makeOfflineId = (prefix = 'offline') => `${prefix}-${uuid()}`
export const makeClientMutationId = () => uuid()

export async function putOfflineBlob(blob, meta = {}) {
  if (!storageAvailable()) throw new Error('Archiviazione offline non disponibile su questo dispositivo')
  if (!(blob instanceof Blob) || blob.size <= 0) throw new Error('Foto offline vuota o non valida')
  const id = makeOfflineId('offline-blob')
  await db.blobs.put({ id, blob, meta, createdAt: now() })
  return id
}
export async function getOfflineBlob(id) {
  if (!storageAvailable() || !id) return null
  return db.blobs.get(id)
}
export async function deleteOfflineBlob(id) {
  if (storageAvailable() && id) await db.blobs.delete(id)
}

export async function getCachedCollection(entity, hotelId) {
  if (!storageAvailable()) return []
  const row = await db.cache.get(cacheKey(entity, hotelId))
  return Array.isArray(row?.items) ? row.items : []
}
export async function setCachedCollection(entity, hotelId, items) {
  if (!storageAvailable()) return
  await db.cache.put({ key: cacheKey(entity, hotelId), entity, hotelId, items, updatedAt: now() })
}
export async function findCachedHotelId(entity, itemId) {
  if (!storageAvailable()) return null
  const rows = await db.cache.where('entity').equals(entity).toArray()
  return rows.find((row) => Array.isArray(row.items) && row.items.some((item) => item.id === itemId))?.hotelId || null
}
async function replayPending(entity, hotelId, baseItems) {
  if (!storageAvailable()) return baseItems
  let items = [...baseItems]
  const pending = await db.outbox.where('entity').equals(entity).and((op) => op.hotelId === hotelId).sortBy('id')
  for (const op of pending) {
    const visualPayload = op.cachePayload || op.payload
    if (op.action === 'create') {
      if (!items.some((item) => item.id === op.tempId)) items.unshift({ ...visualPayload, id: op.tempId, _offline: true })
    } else if (op.action === 'update') items = items.map((item) => item.id === op.targetId ? { ...item, ...visualPayload, _offline: true } : item)
    else if (op.action === 'delete') items = items.filter((item) => item.id !== op.targetId)
  }
  return items
}
export async function cacheRemoteCollection(entity, hotelId, remoteItems) {
  const merged = await replayPending(entity, hotelId, remoteItems)
  await setCachedCollection(entity, hotelId, merged)
  return merged
}

async function compactMutation(op) {
  const all = await db.outbox.where('entity').equals(op.entity).and((row) => row.hotelId === op.hotelId).sortBy('id')
  if (op.action === 'update') {
    if (String(op.targetId || '').startsWith('offline-')) {
      const createOp = all.find((row) => row.action === 'create' && row.tempId === op.targetId)
      if (createOp) {
        const mergedPayload = mergeQueuedPayload(createOp.payload || {}, op.payload || {})
        const mergedCache = { ...(createOp.cachePayload || createOp.payload || {}), ...(op.cachePayload || op.payload || {}) }
        await cleanupPayloadBlobs(createOp.payload, mergedPayload)
        await db.outbox.update(createOp.id, { payload: mergedPayload, cachePayload: mergedCache, attempts: 0, nextAttemptAt: 0, lastError: null, revision: nextRevision(createOp) })
        return { compacted: true }
      }
    }
    if (all.some((row) => row.action === 'delete' && row.targetId === op.targetId)) { await cleanupPayloadBlobs(op.payload); return { compacted: true } }
    const priorUpdates = all.filter((row) => row.action === 'update' && row.targetId === op.targetId)
    const latest = priorUpdates.at(-1)
    if (latest) {
      const mergedPayload = mergeQueuedPayload(latest.payload || {}, op.payload || {})
      const mergedCache = { ...(latest.cachePayload || latest.payload || {}), ...(op.cachePayload || op.payload || {}) }
      await cleanupPayloadBlobs(latest.payload, mergedPayload)
      await db.outbox.update(latest.id, { payload: mergedPayload, cachePayload: mergedCache, attempts: 0, nextAttemptAt: 0, lastError: null, revision: nextRevision(latest) })
      return { compacted: true }
    }
  }
  if (op.action === 'delete') {
    if (String(op.targetId || '').startsWith('offline-')) {
      const related = all.filter((row) => row.tempId === op.targetId || row.targetId === op.targetId)
      for (const row of related) await cleanupPayloadBlobs(row.payload)
      if (related.length) await db.outbox.bulkDelete(related.map((row) => row.id))
      return { compacted: true, cancelledCreate: true }
    }
    const relatedUpdates = all.filter((row) => row.action === 'update' && row.targetId === op.targetId)
    for (const row of relatedUpdates) await cleanupPayloadBlobs(row.payload)
    if (relatedUpdates.length) await db.outbox.bulkDelete(relatedUpdates.map((row) => row.id))
    if (all.some((row) => row.action === 'delete' && row.targetId === op.targetId)) return { compacted: true }
  }
  return { compacted: false }
}

export async function enqueueMutation({ entity, hotelId, action, payload = null, cachePayload = null, targetId = null, tempId = null }) {
  if (!hotelId) throw new Error(`hotelId mancante per coda offline ${entity}:${action}`)
  if (!storageAvailable()) throw new Error('Archiviazione offline non disponibile su questo dispositivo')
  const nextPayload = action === 'create' ? { ...(payload || {}), clientMutationId: payload?.clientMutationId || makeClientMutationId() } : payload
  const op = { entity, hotelId, action, payload: nextPayload, cachePayload, targetId, tempId, createdAt: now(), attempts: 0, nextAttemptAt: 0, lastError: null, revision: 1, leaseOwner: null, leaseUntil: 0 }
  const compacted = await compactMutation(op)
  const current = await getCachedCollection(entity, hotelId)
  const visualPayload = cachePayload || nextPayload
  let next = current
  if (action === 'create') next = [{ ...visualPayload, id: tempId, _offline: true }, ...current.filter((item) => item.id !== tempId)]
  if (action === 'update') next = current.map((item) => item.id === targetId ? { ...item, ...visualPayload, _offline: true } : item)
  if (action === 'delete') next = current.filter((item) => item.id !== targetId)
  await setCachedCollection(entity, hotelId, next)
  if (!compacted.compacted) await db.outbox.add(op)
  dispatchDataChange(entity, hotelId)
  await dispatchStatus()
  if (onlineNow()) scheduleDrain(0)
  return action === 'create' ? next.find((item) => item.id === tempId) : true
}

export function registerOfflineHandler(entity, handler) {
  handlers.set(entity, handler)
  if (storageAvailable() && onlineNow() && typeof queueMicrotask === 'function') queueMicrotask(() => drainOfflineQueue())
}
async function acquireDrainLease() {
  try {
    return await db.transaction('rw', db.leases, async () => {
      const current = await db.leases.get(DRAIN_LEASE_KEY)
      if (current && Number(current.expiresAt || 0) > now() && current.owner !== DRAIN_OWNER) return false
      if (current) await db.leases.delete(DRAIN_LEASE_KEY)
      await db.leases.add({ key: DRAIN_LEASE_KEY, owner: DRAIN_OWNER, expiresAt: now() + DRAIN_LEASE_MS })
      return true
    })
  } catch (error) {
    if (error?.name === 'ConstraintError') return false
    throw error
  }
}
async function releaseDrainLease() {
  await db.transaction('rw', db.leases, async () => {
    const current = await db.leases.get(DRAIN_LEASE_KEY)
    if (current?.owner === DRAIN_OWNER) await db.leases.delete(DRAIN_LEASE_KEY)
  })
}
async function claimOutboxOperation(id) {
  return db.transaction('rw', db.outbox, async () => {
    const current = await db.outbox.get(id)
    if (!current) return null
    const leaseUntil = Number(current.leaseUntil || 0)
    if (leaseUntil > now() && current.leaseOwner && current.leaseOwner !== DRAIN_OWNER) return null
    const lease = { leaseOwner: DRAIN_OWNER, leaseUntil: now() + DRAIN_LEASE_MS }
    await db.outbox.update(id, lease)
    return { ...current, ...lease, revision: Number(current.revision || 1) }
  })
}
async function releaseClaim(id, extra = {}) {
  await db.outbox.update(id, { ...extra, leaseOwner: null, leaseUntil: 0 })
}
async function moveToFailures(op, error) {
  await db.transaction('rw', db.outbox, db.failures, async () => {
    const current = await db.outbox.get(op.id)
    if (!current || current.leaseOwner !== DRAIN_OWNER || Number(current.revision || 1) !== Number(op.revision || 1)) return
    await db.failures.add({ ...current, leaseOwner: null, leaseUntil: 0, sourceOutboxId: op.id, failedAt: now(), error: errorText(error), errorCode: error?.code || null, conflictFields: error?.conflictFields || null })
    await db.outbox.delete(op.id)
  })
}
async function handleConcurrentMutation(op, result) {
  const current = await db.outbox.get(op.id)
  if (!current || Number(current.revision || 1) === Number(op.revision || 1)) return false
  if (op.action === 'create' && op.tempId && result?.id != null) {
    const { clientMutationId: _mutation, ...updatePayload } = current.payload || {}
    await releaseClaim(op.id, { action: 'update', targetId: result.id, tempId: null, payload: updatePayload, attempts: 0, nextAttemptAt: 0, lastError: null })
  } else {
    await releaseClaim(op.id, { attempts: 0, nextAttemptAt: 0, lastError: null })
  }
  return true
}
export async function drainOfflineQueue() {
  if (!storageAvailable() || draining || !onlineNow()) return
  const hasLease = await acquireDrainLease()
  if (!hasLease) return
  draining = true
  await dispatchStatus()
  let nextWake = null
  try {
    const operations = await db.outbox.orderBy('id').toArray()
    for (const snapshot of operations) {
      const handler = handlers.get(snapshot.entity)
      if (!handler) continue
      const wait = Number(snapshot.nextAttemptAt || 0) - now()
      if (wait > 0) { nextWake = nextWake == null ? wait : Math.min(nextWake, wait); continue }
      const op = await claimOutboxOperation(snapshot.id)
      if (!op) continue
      let targetId = op.targetId
      if (targetId && String(targetId).startsWith('offline-')) {
        const mapped = await db.idmap.get(targetId)
        if (!mapped?.realId) { await releaseClaim(op.id); continue }
        targetId = mapped.realId
      }
      try {
        const result = await handler(op, targetId)
        if (op.action === 'create' && op.tempId && result?.id != null) {
          await db.idmap.put({ tempId: op.tempId, realId: result.id })
          const cached = await getCachedCollection(op.entity, op.hotelId)
          await setCachedCollection(op.entity, op.hotelId, cached.map((item) => item.id === op.tempId ? { ...item, ...result, id: result.id, _offline: false } : item))
        }
        if (await handleConcurrentMutation(op, result)) {
          dispatchDataChange(op.entity, op.hotelId)
          scheduleDrain(0)
          continue
        }
        await db.outbox.delete(op.id)
        dispatchDataChange(op.entity, op.hotelId)
      } catch (error) {
        const current = await db.outbox.get(op.id)
        if (current && Number(current.revision || 1) !== Number(op.revision || 1)) {
          await releaseClaim(op.id, { attempts: 0, nextAttemptAt: 0, lastError: null })
          scheduleDrain(0)
          continue
        }
        if (isPermanentError(error)) {
          console.error('offline sync blocked permanently', op.entity, op.action, error)
          await moveToFailures(op, error)
          dispatchDataChange(op.entity, op.hotelId)
          continue
        }
        const attempts = Number(op.attempts || 0) + 1
        const delay = nextDelay(attempts - 1)
        await releaseClaim(op.id, { attempts, nextAttemptAt: now() + delay, lastError: errorText(error) })
        if (!isTransientNetworkError(error)) console.error('offline sync retry', op.entity, op.action, error)
        nextWake = nextWake == null ? delay : Math.min(nextWake, delay)
      }
    }
  } finally {
    draining = false
    await releaseDrainLease().catch(() => {})
    await dispatchStatus()
    if (onlineNow() && nextWake != null) scheduleDrain(nextWake)
  }
}
export async function getOfflineStatus() {
  if (!storageAvailable()) return { pending: 0, blocked: 0, online: onlineNow(), syncing: false }
  const [pending, blocked] = await Promise.all([db.outbox.count(), db.failures.count()])
  return { pending, blocked, online: onlineNow(), syncing: draining }
}
export async function getOfflineFailures() {
  return storageAvailable() ? db.failures.orderBy('id').reverse().toArray() : []
}
export async function retryOfflineFailure(id, { force = false } = {}) {
  if (!storageAvailable()) return false
  const failed = await db.failures.get(id)
  if (!failed) return false
  const { id: _id, sourceOutboxId: _source, failedAt: _failedAt, error: _error, errorCode: _code, conflictFields: _fields, leaseOwner: _leaseOwner, leaseUntil: _leaseUntil, ...op } = failed
  const payload = { ...(op.payload || {}) }
  if (force) { delete payload._syncBaseUpdatedAt; delete payload._syncBaseValues }
  await db.outbox.add({ ...op, payload, attempts: 0, nextAttemptAt: 0, lastError: null, createdAt: now(), revision: nextRevision(op), leaseOwner: null, leaseUntil: 0 })
  await db.failures.delete(id)
  dispatchDataChange(failed.entity, failed.hotelId)
  await dispatchStatus(); scheduleDrain(0)
  return true
}
export async function discardOfflineFailure(id) {
  if (!storageAvailable()) return false
  const failed = await db.failures.get(id)
  if (!failed) return false
  await cleanupPayloadBlobs(failed.payload)
  await db.failures.delete(id)
  dispatchDataChange(failed.entity, failed.hotelId)
  await dispatchStatus()
  return true
}

if (typeof window !== 'undefined' && storageAvailable()) {
  window.addEventListener('online', () => scheduleDrain(0))
  window.addEventListener('online', dispatchStatus)
  window.addEventListener('offline', dispatchStatus)
  window.addEventListener('focus', () => { if (onlineNow()) scheduleDrain(0) })
  document?.addEventListener?.('visibilitychange', () => { if (document.visibilityState === 'visible' && onlineNow()) scheduleDrain(0) })
  setInterval(async () => { const status = await getOfflineStatus().catch(() => null); if (status?.pending && onlineNow()) scheduleDrain(0) }, 15000)
  queueMicrotask(() => { dispatchStatus(); scheduleDrain(0) })
}
