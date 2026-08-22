import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('filtri segnalazioni includono reparto categoria origine data e reset', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /\[origin, setOrigin\] = useState\(''\)/)
  assert.match(app, /\[issueDate, setIssueDate\] = useState\(''\)/)
  assert.match(app, /aria-label="Reparto"/)
  assert.match(app, /aria-label="Categoria"/)
  assert.match(app, /aria-label="Origine"/)
  assert.match(app, /aria-label="Data segnalazione"/)
  assert.match(app, />Azzera filtri<\/button>/)
  assert.match(app, /!origin \|\| \(issue\.origin \|\| 'App'\) === origin/)
  assert.match(app, /return local === issueDate/)
  assert.match(app, /issue\.department \|\| ''/)
  assert.match(app, /issue\.category \|\| ''/)
  assert.match(app, /issue\.origin \|\| ''/)
})
