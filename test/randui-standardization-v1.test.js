import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.promises.readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('RandUI keeps v1 stable while standardization is independently versioned', async () => {
  const contract = await read('src/randapp/randui/design-contract.js')
  assert.match(contract, /RANDUI_VERSION/)
  assert.match(contract, /1\.0\.0/)
  assert.match(contract, /STANDARDIZATION_VERSION/)
})

test('RandUI motion is centralized and reduced motion fails safe', async () => {
  const motion = await read('src/randapp/randui/motion-contract.js')
  assert.match(motion, /prefers-reduced-motion/)
  assert.match(motion, /duration/)
})

test('RandUI icons have one semantic adapter and one runtime owner', async () => {
  const icons = await read('src/randapp/randui/icon-contract.js')
  assert.match(icons, /semantic/i)
  assert.match(icons, /icon/i)
})

test('foundation already protects touch size reduced motion and overflow', async () => {
  const foundation = await read('src/randapp/randui/foundation.css')
  assert.match(foundation, /--rand-touch-min:/)
  assert.match(foundation, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(foundation, /min-width: 0/)
  assert.match(foundation, /max-width: 100%/)
})

test('Ocean preview is preserved while it remains a live gate', async () => {
  const workflow = await read('.github/workflows/digitalocean-preview.yml')
  assert.match(workflow, /name:\s*RandUI Ocean Preview/)
  assert.match(workflow, /environment:\s*preview/)
  assert.match(workflow, /digitalocean\/app_action\/deploy@v2/)
})
