import test from 'node:test'
import assert from 'node:assert/strict'
import {
  flattenInventoryTree,
  inventorySearchText,
  inventoryStockStatus,
  mergeInventoryAttributeSchemas,
  suggestedInventoryReorder,
} from '../src/inventory-domain.js'

test('inventory tree preserves hierarchy and deterministic order', () => {
  const rows = [
    { id: 'b', parentId: 'a', name: 'Lampadine', sortOrder: 20 },
    { id: 'a', parentId: null, name: 'Elettrico', sortOrder: 10 },
    { id: 'c', parentId: 'a', name: 'Cavi', sortOrder: 10 },
  ]
  assert.deepEqual(flattenInventoryTree(rows).map(({ id, depth }) => [id, depth]), [['a', 0], ['c', 1], ['b', 1]])
})

test('category attributes are inherited and child definitions override parents', () => {
  const categories = [
    { id: 'a', parentId: null, attributeSchema: [{ key: 'tensione', label: 'Tensione', unit: 'V' }] },
    { id: 'b', parentId: 'a', attributeSchema: [{ key: 'attacco', label: 'Attacco' }, { key: 'tensione', label: 'Volt', unit: 'V' }] },
  ]
  assert.deepEqual(mergeInventoryAttributeSchemas(categories, 'b'), [
    { key: 'tensione', label: 'Volt', unit: 'V' },
    { key: 'attacco', label: 'Attacco' },
  ])
})

test('stock status and reorder policy handle empty, low and healthy stock', () => {
  assert.equal(inventoryStockStatus({ quantity: 0, minQuantity: 5 }), 'esaurito')
  assert.equal(inventoryStockStatus({ quantity: 4, minQuantity: 5 }), 'sotto_scorta')
  assert.equal(inventoryStockStatus({ quantity: 6, minQuantity: 5 }), 'ok')
  assert.equal(suggestedInventoryReorder({ quantity: 4, minQuantity: 5, idealQuantity: 12 }), 8)
  assert.equal(suggestedInventoryReorder({ quantity: 4, minQuantity: 5, idealQuantity: 12, reorderQuantity: 10 }), 10)
})

test('search includes tags, synonyms, variant and technical attributes', () => {
  const text = inventorySearchText({
    name: 'Lampadina LED', category: 'Lampadine', variantLabel: 'E27 9W', tags: ['corridoio'], synonyms: ['bulbo'], attributes: { kelvin: 3000 },
  })
  for (const token of ['lampadina', 'e27', 'corridoio', 'bulbo', '3000']) assert.ok(text.includes(token))
})
