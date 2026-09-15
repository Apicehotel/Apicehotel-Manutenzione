import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('Fase 3: gli avvisi mostrano azioni solo con il permesso centrale corrispondente', () => {
  const source = read('../src/randapp/operations/UrgentView.jsx')
  assert.match(source, /canUser\(user,'urgent','take_charge'\)/)
  assert.match(source, /canUser\(user,'urgent','complete'\)/)
  assert.match(source, /canUser\(user,'issues','create'\)/)
  assert.match(source, /canTake&&item\.status==='aperta'/)
  assert.match(source, /canComplete&&item\.status==='presa_in_carico'/)
  assert.match(source, /canTransform&&item\.status!=='completata'/)
})

test('Fase 3: le mutazioni restano hotel-scoped e passano dal contratto dati governato', () => {
  const source = read('../src/randapp/operations/UrgentView.jsx')
  assert.match(source, /updateUrgentRow\(item\.id,\{hotelId:hotel\.id/)
  assert.match(source, /linkUrgentToIssue\(urgent\.id,hotel\.id/)
})
