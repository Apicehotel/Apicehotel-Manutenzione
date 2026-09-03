import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('modalità Grande: nessun font-size fisso tra 9 e 14px, scaling via custom properties', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

  // Nessuno zoom CSS (richiesto esplicitamente, verificato anche in ui-scale.test.js).
  assert.doesNotMatch(styles, /zoom:/)

  // Variabili per i testi secondari, definite e scalate nelle 3 modalità.
  assert.match(styles, /--font-xs: 11px;/)
  assert.match(styles, /--font-sm: 13px;/)
  assert.match(styles, /html\[data-ui-size="small"\][^}]*--font-xs: 10px;/s)
  assert.match(styles, /html\[data-ui-size="large"\][^}]*--font-xs: 16px;/s)
  assert.match(styles, /html\[data-ui-size="large"\][^}]*--font-sm: 19px;/s)

  // Nessun font-size fisso residuo tra 9 e 14.x px in tutto il foglio di stile.
  const leftover = styles.match(/font-size:\s*(9|1[0-4])(\.5)?px/g) || []
  assert.deepEqual(leftover, [])

  // line-height relativo sui badge (non taglia il testo quando --font-xs cresce in Grande).
  assert.doesNotMatch(styles, /\.tab-badge \{[^}]*line-height:\s*\d+px/)
  assert.doesNotMatch(styles, /\.app-nav-badge \{[^}]*line-height:\s*\d+px/)
})

test('modalità Grande: bottom nav, header, filtri e calendario Planning possono andare a capo invece di troncare', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(styles, /html\[data-ui-size="large"\] \.app-nav button span,\r?\nhtml\[data-ui-size="large"\] \.hotel-identity strong,\r?\nhtml\[data-ui-size="large"\] \.hotel-identity small,\r?\nhtml\[data-ui-size="large"\] \.urgent-filters button,\r?\nhtml\[data-ui-size="large"\] \.work-event span,\r?\nhtml\[data-ui-size="large"\] \.sale-event span \{\r?\n  white-space: normal;/)
})

test('modalità Grande: i controlli restano cliccabili (min-height via --control-h) senza distinzione per modalità', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.match(styles, /^button:not\(\.icon-button\):not\(\.panel-close\):not\(\.form-close\):not\(\.hk-sheet > header button\):not\(\.sale-event > button\):not\(\.dot\) \{ min-height: var\(--control-h\); \}$/m)
  assert.match(styles, /^input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\), select \{ min-height: var\(--control-h\); \}$/m)
})
