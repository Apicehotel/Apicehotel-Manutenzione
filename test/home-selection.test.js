import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Home selezione struttura: contenuto centrato verticalmente su mobile, niente vuoto in basso', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  // Prima: '.home-page .home-content { padding: 0 0 36px; }' lasciava il blocco
  // (titolo + card + puntini + testo) ancorato in alto, con metà schermo vuota
  // sotto. Ora il contenuto è centrato nello spazio disponibile sotto l'header.
  assert.match(styles, /\.home-page \.home-content \{ padding: 0 0 max\(24px, env\(safe-area-inset-bottom\)\); display: flex; flex-direction: column; justify-content: center; overflow-y: auto; overflow-x: hidden; \}/)
})
