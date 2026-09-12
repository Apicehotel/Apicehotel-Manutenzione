export const RANDSALE2D_SCHEMA_VERSION = 1
export const RANDSALE2D_GRID_CM = 25
export const RANDSALE2D_TYPES = Object.freeze({
  table: { label: 'Tavolo', width: 180, height: 80, color: '#38bdf8' },
  chair: { label: 'Sedia', width: 45, height: 45, color: '#a78bfa' },
  stage: { label: 'Palco', width: 300, height: 160, color: '#fb7185' },
  buffet: { label: 'Buffet', width: 220, height: 70, color: '#fbbf24' },
  screen: { label: 'Schermo', width: 220, height: 25, color: '#34d399' },
  platform: { label: 'Pedana', width: 160, height: 100, color: '#f97316' },
})

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
export const snapValue = (value, grid = RANDSALE2D_GRID_CM) => Math.round(finite(value, 0) / grid) * grid
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export function createLayoutDocument({ roomKey = null, roomName = '', layoutKey = null, layoutName = '', pax = null } = {}) {
  return { schemaVersion: RANDSALE2D_SCHEMA_VERSION, unit: 'cm', room: { width: 1200, height: 800 }, roomKey, roomName, layoutKey, layoutName, pax: pax ? Number(pax) : null, grid: RANDSALE2D_GRID_CM, items: [] }
}

export function bindLayoutDocument(document, booking = {}) {
  return normalizeLayoutDocument({
    ...normalizeLayoutDocument(document),
    roomKey: booking.roomKey || null,
    roomName: booking.room || '',
    layoutKey: booking.layoutKey || null,
    layoutName: booking.layout || '',
    pax: booking.pax ? Number(booking.pax) : null,
  })
}

export function normalizeLayoutDocument(value, fallback = {}) {
  const base = createLayoutDocument(fallback), source = value && typeof value === 'object' ? value : {}
  const room = { width: clamp(finite(source.room?.width, base.room.width), 300, 5000), height: clamp(finite(source.room?.height, base.room.height), 300, 5000) }
  const items = Array.isArray(source.items) ? source.items.flatMap((raw, index) => {
    const type = RANDSALE2D_TYPES[raw?.type] ? raw.type : null
    if (!type) return []
    const preset = RANDSALE2D_TYPES[type], width = clamp(finite(raw.width, preset.width), 20, room.width), height = clamp(finite(raw.height, preset.height), 20, room.height)
    return [{ id: String(raw.id || `${type}-${index + 1}`), type, label: String(raw.label || preset.label).slice(0, 60), x: clamp(finite(raw.x, 0), 0, room.width - width), y: clamp(finite(raw.y, 0), 0, room.height - height), width, height, rotation: ((Math.round(finite(raw.rotation, 0) / 15) * 15) % 360 + 360) % 360 }]
  }) : []
  return { ...base, ...source, schemaVersion: RANDSALE2D_SCHEMA_VERSION, unit: 'cm', room, grid: clamp(finite(source.grid, RANDSALE2D_GRID_CM), 10, 100), items }
}

export function addLayoutItem(document, type) {
  const doc = normalizeLayoutDocument(document), preset = RANDSALE2D_TYPES[type]
  if (!preset || doc.items.length >= 250) return doc
  const serial = doc.items.filter(item => item.type === type).length + 1
  return normalizeLayoutDocument({ ...doc, items: [...doc.items, { id: `${type}-${Date.now()}-${serial}`, type, label: `${preset.label} ${serial}`, width: preset.width, height: preset.height, x: snapValue(doc.room.width / 2 - preset.width / 2, doc.grid), y: snapValue(doc.room.height / 2 - preset.height / 2, doc.grid), rotation: 0 }] })
}

export function updateLayoutItem(document, id, patch) {
  const doc = normalizeLayoutDocument(document)
  return normalizeLayoutDocument({ ...doc, items: doc.items.map(item => item.id === id ? { ...item, ...patch } : item) })
}

export const removeLayoutItem = (document, id) => ({ ...normalizeLayoutDocument(document), items: normalizeLayoutDocument(document).items.filter(item => item.id !== id) })

export function validateLayoutDocument(document) {
  const doc = normalizeLayoutDocument(document), issues = []
  const seen = new Set()
  for (const item of doc.items) {
    if (seen.has(item.id)) issues.push(`Identificativo duplicato: ${item.id}`)
    seen.add(item.id)
    if (item.x < 0 || item.y < 0 || item.x + item.width > doc.room.width || item.y + item.height > doc.room.height) issues.push(`${item.label} è fuori dalla sala`)
  }
  return { valid: issues.length === 0, issues, document: doc }
}

export function summarizeLayout(document) {
  const doc = normalizeLayoutDocument(document), counts = new Map()
  doc.items.forEach(item => counts.set(item.type, (counts.get(item.type) || 0) + 1))
  return [...counts].map(([type, count]) => ({ type, label: RANDSALE2D_TYPES[type].label, count }))
}
