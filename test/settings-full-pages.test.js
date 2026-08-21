import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Il mio profilo, Cambia PIN, Manuale, Feedback sono ora pagine piene (setTab), non più popup a comparsa', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  // I 4 pulsanti del drawer usano setTab direttamente, come qualunque altra sezione dell'app.
  assert.match(app, /<button onClick=\{\(\) => \{ setTab\('Il mio profilo'\); setMenuOpen\(false\) \}\}>/)
  assert.match(app, /<button onClick=\{\(\) => \{ setTab\('Cambia PIN'\); setMenuOpen\(false\) \}\}>/)
  assert.match(app, /<button onClick=\{\(\) => \{ setTab\('Manuale'\); setMenuOpen\(false\) \}\}>/)
  assert.match(app, /<button onClick=\{\(\) => \{ setTab\('Feedback'\); setMenuOpen\(false\) \}\}>/)
  // MenuPanel non riceve più onClose: non c'è più nulla da "chiudere", è una pagina come le altre.
  assert.doesNotMatch(app, /function MenuPanel\([^)]*onClose/)
  assert.match(app, /return <section className="settings-page">/)
  // Titolo pagina, safe-area e bottom nav condivisi con tutte le altre sezioni: nessun titolo
  // duplicato dentro MenuPanel (rimosso <header><h2>{titles[type]}</h2>...), lo mostra il
  // title-row generico già usato da Segnalazioni/Interventi/ecc.
  assert.doesNotMatch(app, /titles\[type\]/)
  // Niente più overlay/backdrop per queste pagine.
  assert.doesNotMatch(app, /\.menu-panel-backdrop/)
  assert.doesNotMatch(styles, /\.menu-panel-backdrop/)
  assert.doesNotMatch(styles, /^\.menu-panel \{/m)
  assert.match(styles, /\.settings-page \{ max-width:620px; \}/)
})
