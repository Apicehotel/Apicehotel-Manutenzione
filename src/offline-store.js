import Dexie from 'dexie'

const db = new Dexie('apiceOffline')
db.version(1).stores({
  cache: '&key,entity,hotelId,updatedAt',
  outbox: '++id,entity,hotelId,action,tempId,targetId,createdAt',
  idmap: '&tempId,realId',
})

const handlers = new Map()
let draining = false
const onlineNow = () => typeof navigator === 'undefined' || navigator.onLine
const cacheKey = (entity, hotelId) => `${entity}:${hotelId}`

const dispatchStatus = async () => {
  if (typeof window === 'undefined') return
  const pending = await db.outbox.count().catch(() => 0)
  window.dispatchEvent(new CustomEvent('apice-offline-status', { detail: { pending, online: onlineNow() } }))
}

export const makeOfflineId = (prefix = 'offline') => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
export const isTransientNetworkError = (error) => !onlineNow() || /failed to fetch|network|load failed|timeout|connection/i.test(String(error?.message || error || ''))

export async function getCachedCollection(entity, hotelId) {
  const row = await db.cache.get(cacheKey(entity, hotelId))
  return Array.isArray(row?.items) ? row.items : []
}

export async function setCachedCollection(entity, hotelId, items) {
  await db.cache.put({ key: cacheKey(entity, hotelId), entity, hotelId, items, updatedAt: Date.now() })
}

export async function findCachedHotelId(entity, itemId) {
  const rows = await db.cache.where('entity').equals(entity).toArray()
  return rows.find((row) => Array.isArray(row.items) && row.items.some((item) => item.id === itemId))?.hotelId || null
}

async function replayPending(entity, hotelId, baseItems) {
  let items = [...baseItems]
  const pending = await db.outbox.where({ entity, hotelId }).sortBy('id')
  for (const op of pending) {
    if (op.action === 'create') {
      if (!items.some((item) => item.id === op.tempId)) items.unshift({ ...op.payload, id: op.tempId, _offline: true })
    } else if (op.action === 'update') {
      items = items.map((item) => item.id === op.targetId ? { ...item, ...op.payload, _offline: true } : item)
    } else if (op.action === 'delete') {
      items = items.filter((item) => item.id !== op.targetId)
    }
  }
  return items
}

export async function cacheRemoteCollection(entity, hotelId, remoteItems) {
  const merged = await replayPending(entity, hotelId, remoteItems)
  await setCachedCollection(entity, hotelId, merged)
  return merged
}

export async function enqueueMutation({ entity, hotelId, action, payload = null, targetId = null, tempId = null }) {
  if (!hotelId) throw new Error(`hotelId mancante per coda offline ${entity}:${action}`)
  await db.outbox.add({ entity, hotelId, action, payload, targetId, tempId, createdAt: Date.now() })
  const current = await getCachedCollection(entity, hotelId)
  let next = current
  if (action === 'create') next = [{ ...payload, id: tempId, _offline: true }, ...current.filter((item) => item.id !== tempId)]
  if (action === 'update') next = current.map((item) => item.id === targetId ? { ...item, ...payload, _offline: true } : item)
  if (action === 'delete') next = current.filter((item) => item.id !== targetId)
  await setCachedCollection(entity, hotelId, next)
  await dispatchStatus()
  return action === 'create' ? next.find((item) => item.id === tempId) : true
}

export function registerOfflineHandler(entity, handler) {
  handlers.set(entity, handler)
  if (onlineNow() && typeof queueMicrotask === 'function') queueMicrotask(() => drainOfflineQueue())
}

export async function drainOfflineQueue() {
  if (draining || !onlineNow()) return
  draining = true
  try {
    const operations = await db.outbox.orderBy('id').toArray()
    for (const op of operations) {
      const handler = handlers.get(op.entity)
      if (!handler) continue
      let targetId = op.targetId
      if (targetId && String(targetId).startsWith('offline-')) {
        const mapped = await db.idmap.get(targetId)
        if (!mapped?.realId) break
        targetId = mapped.realId
      }
      try {
        const result = await handler(op, targetId)
        if (op.action === 'create' && op.tempId && result?.id != null) {
          await db.idmap.put({ tempId: op.tempId, realId: result.id })
          const cached = await getCachedCollection(op.entity, op.hotelId)
          await setCachedCollection(op.entity, op.hotelId, cached.map((item) => item.id === op.tempId ? { ...item, ...result, id: result.id, _offline: false } : item))
        }
        await db.outbox.delete(op.id)
      } catch (error) {
        if (!isTransientNetworkError(error)) console.error('offline sync blocked', op.entity, op.action, error)
        break
      }
    }
  } finally {
    draining = false
    await dispatchStatus()
  }
}

export async function getOfflineStatus() {
  return { pending: await db.outbox.count(), online: onlineNow() }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', drainOfflineQueue)
  window.addEventListener('online', dispatchStatus)
  window.addEventListener('offline', dispatchStatus)
  queueMicrotask(dispatchStatus)
}
