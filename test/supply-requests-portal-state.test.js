import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/randapp/SupplyRequestsPortal.jsx', import.meta.url), 'utf8')

test('supply request detail state belongs to SupplyRequestsPortal', () => {
  const productManager = source.match(/function ProductManager[\s\S]*?function RequestComposer/)?.[0] || ''
  const portal = source.match(/export default function SupplyRequestsPortal[\s\S]*$/)?.[0] || ''

  assert.doesNotMatch(productManager, /selectedRequest|setSelectedRequest|onDetailChange/)
  assert.match(portal, /const \[selectedRequest, setSelectedRequest\] = useState\(null\)/)
  assert.match(portal, /onDetailChange\?\.\(selectedRequest \? \{ kind: 'supply'/)
  assert.match(portal, /if \(selectedRequest\) return <SupplyRequestDetail/)
  assert.match(portal, /onOpen=\{setSelectedRequest\}/)
})
