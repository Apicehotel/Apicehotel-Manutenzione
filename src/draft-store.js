const PREFIX = 'randapp-draft-v1'
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

const storage = () => {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}
const safePart = (value) => String(value || 'anonymous').trim().replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()

export function draftKey(kind, hotelId, userId) {
  return `${PREFIX}:${safePart(kind)}:${safePart(hotelId)}:${safePart(userId)}`
}

export function sanitizeDraft(value) {
  if (!value || typeof value !== 'object') return null
  const clean = { ...value }
  delete clean.photoData
  delete clean.completionPhotoData
  if (clean.draft && typeof clean.draft === 'object') {
    clean.draft = { ...clean.draft }
    delete clean.draft.photoData
    delete clean.draft.completionPhotoData
  }
  return clean
}

export function loadDraft(kind, hotelId, userId, { ttlMs = DEFAULT_TTL_MS } = {}) {
  const store = storage()
  if (!store) return null
  const key = draftKey(kind, hotelId, userId)
  try {
    const row = JSON.parse(store.getItem(key) || 'null')
    if (!row?.savedAt || !row?.value) return null
    if (Date.now() - Number(row.savedAt) > ttlMs) { store.removeItem(key); return null }
    return row.value
  } catch {
    try { store.removeItem(key) } catch {}
    return null
  }
}

export function saveDraft(kind, hotelId, userId, value) {
  const store = storage()
  if (!store) return false
  const clean = sanitizeDraft(value)
  if (!clean) return false
  try {
    store.setItem(draftKey(kind, hotelId, userId), JSON.stringify({ savedAt: Date.now(), value: clean }))
    return true
  } catch {
    return false
  }
}

export function clearDraft(kind, hotelId, userId) {
  const store = storage()
  if (!store) return
  try { store.removeItem(draftKey(kind, hotelId, userId)) } catch {}
}
