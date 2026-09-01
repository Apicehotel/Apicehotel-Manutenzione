export const INVENTORY_ITEM_TYPES = Object.freeze([
  'consumabile',
  'ricambio',
  'attrezzatura',
  'dpi',
  'materiale',
])

export const INVENTORY_MOVEMENT_TYPES = Object.freeze([
  'carico',
  'scarico',
  'consumo',
  'trasferimento',
  'rettifica',
  'reso',
  'inventario',
])

export const INVENTORY_LOCATION_KINDS = Object.freeze([
  'magazzino',
  'zona',
  'scaffale',
  'ripiano',
  'cassetto',
  'area',
])

export const INVENTORY_DEFAULT_ACTIONS = Object.freeze([
  'sostituzione',
  'riparazione',
  'pulizia',
  'regolazione',
  'verifica',
])

export function inventoryStockStatus(item = {}) {
  const quantity = Number(item.quantity || 0)
  const minimum = Number(item.minQuantity || 0)
  if (quantity <= 0) return 'esaurito'
  if (minimum > 0 && quantity <= minimum) return 'sotto_scorta'
  return 'ok'
}

export function suggestedInventoryReorder(item = {}) {
  const quantity = Number(item.quantity || 0)
  const minimum = Number(item.minQuantity || 0)
  if (quantity > minimum) return 0
  const explicit = Number(item.reorderQuantity || 0)
  if (explicit > 0) return explicit
  const ideal = Number(item.idealQuantity || 0)
  if (ideal > quantity) return ideal - quantity
  return Math.max(0, minimum - quantity)
}

export function inventorySearchText(item = {}) {
  const attributes = item.attributes && typeof item.attributes === 'object'
    ? Object.values(item.attributes)
    : []
  return [
    item.name,
    item.category,
    item.categoryCode,
    item.location,
    item.sku,
    item.barcode,
    item.manufacturer,
    item.model,
    item.variantLabel,
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(item.synonyms) ? item.synonyms : []),
    ...attributes,
  ].filter(Boolean).join(' ').toLocaleLowerCase('it')
}

export function buildInventoryTree(rows = []) {
  const byId = new Map(rows.map((row) => [row.id, { ...row, children: [] }]))
  const roots = []
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(node)
    else roots.push(node)
  }
  const sort = (nodes) => {
    nodes.sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || String(a.name || '').localeCompare(String(b.name || ''), 'it'))
    nodes.forEach((node) => sort(node.children))
  }
  sort(roots)
  return roots
}

export function flattenInventoryTree(rows = []) {
  const result = []
  const walk = (nodes, depth = 0) => {
    for (const node of nodes) {
      result.push({ ...node, depth })
      walk(node.children || [], depth + 1)
    }
  }
  walk(buildInventoryTree(rows))
  return result
}

export function mergeInventoryAttributeSchemas(categories = [], categoryId) {
  const byId = new Map(categories.map((row) => [row.id, row]))
  const chain = []
  const visited = new Set()
  let current = byId.get(categoryId)
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    chain.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : null
  }
  const fields = new Map()
  for (const category of chain) {
    for (const field of Array.isArray(category.attributeSchema) ? category.attributeSchema : []) {
      if (field?.key) fields.set(field.key, { ...field })
    }
  }
  return Array.from(fields.values())
}
