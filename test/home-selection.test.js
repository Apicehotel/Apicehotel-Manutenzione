import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Home selezione struttura: logo, nome e tagline spostati nel contenuto centrale, più grandi', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  // L'header ora contiene solo il pulsante Admin (allineato a destra).
  assert.match(app, /<header className="home-header"><button className="home-admin" onClick=\{onAdmin\}>/)
  assert.match(styles, /\.home-header \{[^}]*justify-content: flex-end;/)
  // Logo + nome + tagline: dentro il contenuto centrale, non più nella barra sottile in alto.
  assert.match(app, /<main className="home-content"><section className="home-brand-hero"><img className="home-mascot" src="\/logos\/apicehotel-mascot\.png" alt="" \/><strong className="home-brand-title">APICEHOTEL<\/strong><span className="home-brand-tagline">RandApp Manutenzione<\/span><\/section>/)
  assert.match(styles, /\.home-mascot \{ width: 96px; height: 96px; object-fit: contain; \}/)
  assert.match(styles, /\.home-brand-title \{ font-size: clamp\(28px,4vw,38px\); font-weight: 800;/)
})

test('Home selezione struttura: contenuto centrato verticalmente su mobile, niente vuoto in basso', async () => {
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  // Prima: '.home-page .home-content { padding: 0 0 36px; }' lasciava il blocco
  // (titolo + card + puntini + testo) ancorato in alto, con metà schermo vuota
  // sotto. Ora il contenuto è centrato nello spazio disponibile sotto l'header.
  assert.match(styles, /\.home-page \.home-content \{ padding: 0 0 max\(24px, env\(safe-area-inset-bottom\)\); display: flex; flex-direction: column; justify-content: center; overflow-y: auto; overflow-x: hidden; \}/)
})
