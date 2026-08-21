import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test("nome dell'utente loggato visibile nell'header anche su mobile, prima era nascosto (visibile solo aprendo il menu)", async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  assert.doesNotMatch(styles, /\.hotel-identity small \{ display: none; \}/)
  assert.match(styles, /\.hotel-identity small \{ display: block; font-size: var\(--font-xs\); \}/)
})

test("'Aggiorna' sostituito da 'Pulisci cache', svuota davvero la Cache Storage del service worker prima di ricaricare", async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(app, />Aggiorna</)
  assert.match(app, /const clearCache = async \(\) => \{ if \('caches' in window\) \{ const keys = await caches\.keys\(\); await Promise\.all\(keys\.map\(\(key\) => caches\.delete\(key\)\)\) \} window\.location\.reload\(\) \}/)
  assert.match(app, /<button onClick=\{clearCache\}><Icon name="refresh" \/><span>Pulisci cache<\/span><\/button>/)
})

test("Notifiche e Dimensione interfaccia sono ora dentro 'Il mio profilo', non più voci separate nel menu hamburger", async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(app, /<span>Notifiche<\/span>/)
  // Il fieldset Dimensione interfaccia non è più un elemento diretto del drawer (<nav>...</nav> seguito
  // subito da Logout), ora vive dentro il pannello profilo con classe aggiuntiva profile-ui-scale.
  assert.doesNotMatch(app, /<\/nav><fieldset className="ui-scale-setting">/)
  assert.match(app, /<fieldset className="ui-scale-setting profile-ui-scale">/)
  assert.match(app, /Numero di cellulare<input aria-label="Numero di cellulare"/)
})
