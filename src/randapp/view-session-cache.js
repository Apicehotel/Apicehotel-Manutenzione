/**
 * In-memory last-known lists for primary Shell destinations.
 * Survives remount on bottom-nav switches within the same session so
 * cache-first views can paint before IndexedDB/network return.
 */
const store = new Map()

export function takeViewCache(key) {
  if (!key) return null
  return store.has(key) ? store.get(key) : null
}

export function putViewCache(key, value) {
  if (!key) return
  if (value == null) store.delete(key)
  else store.set(key, value)
}

export function clearViewCache(key) {
  if (!key) store.clear()
  else store.delete(key)
}
