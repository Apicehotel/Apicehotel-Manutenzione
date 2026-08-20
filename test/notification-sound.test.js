import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('src/notification-sound.js: stesso sistema di HotelGio, 4 suoni + Nessuno, scelta persistente', async () => {
  const source = await readFile(new URL('../src/notification-sound.js', import.meta.url), 'utf8')
  assert.match(source, /\{ id: 'classico', label: 'Classico', file: '\/sounds\/classico\.mp3' \}/)
  assert.match(source, /\{ id: 'jazz', label: 'Jazz', file: '\/sounds\/jazz\.mp3' \}/)
  assert.match(source, /\{ id: 'melodia', label: 'Melodia', file: '\/sounds\/melodia\.mp3' \}/)
  assert.match(source, /\{ id: 'miao', label: 'Miao', file: '\/sounds\/miao\.mp3' \}/)
  assert.match(source, /\{ id: 'nessuno', label: 'Nessuno', file: null \}/)
  assert.match(source, /export function getNotifSound\(\) \{/)
  assert.match(source, /export function playNotifSound\(\) \{/)
})

test('4 file audio copiati da HotelGio in public/sounds/', async () => {
  const fs = await import('node:fs/promises')
  const files = await fs.readdir(new URL('../public/sounds/', import.meta.url))
  for (const name of ['classico.mp3', 'jazz.mp3', 'melodia.mp3', 'miao.mp3']) {
    assert.ok(files.includes(name), `manca ${name} in public/sounds/`)
  }
})

test('il suono suona sui nuovi inserimenti realtime (segnalazioni e avvisi urgenti) con app aperta, come su HotelGio', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /subscribeIssues\(hotel\.id, \(payload\) => \{ if \(payload\?\.eventType === 'INSERT'\) playNotifSound\(\); reloadIssues\(\) \}\)/)
  assert.match(app, /subscribeUrgents\(hotel\.id, \(payload\) => \{ if \(payload\?\.eventType === 'INSERT'\) playNotifSound\(\); reloadUrgents\(\) \}\)/)
})

test('pannello Notifiche: selezione del suono con anteprima al tocco, integrata dove già si attivano le push', async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  ])
  assert.match(app, /const \[sound, setSound\] = useState\(\(\) => getNotifSound\(\)\.id\)/)
  assert.match(app, /const chooseSound = \(soundOption\) => \{ setSound\(soundOption\.id\); setNotifSound\(soundOption\.id\); if \(soundOption\.file\) new Audio\(soundOption\.file\)\.play\(\)\.catch\(\(\) => \{\}\) \}/)
  assert.match(app, /<div className="notif-sound-picker">/)
  assert.match(app, /\{SOUNDS\.map\(\(option\) => <button type="button" key=\{option\.id\} className=\{sound === option\.id \? 'active' : ''\} onClick=\{\(\) => chooseSound\(option\)\}>\{option\.label\}<\/button>\)\}/)
  assert.match(styles, /\.notif-sound-choices \{ display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; \}/)
})

test('service worker: notifiche urgenti restano finché non toccate e vibrano più a lungo, come su HotelGio', async () => {
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
  assert.match(sw, /const urgent = Boolean\(payload\.urgent\)/)
  assert.match(sw, /requireInteraction: urgent,/)
  assert.match(sw, /vibrate: urgent \? \[400, 80, 400, 80, 400, 80, 400\] : \[120, 60, 120\],/)
})
