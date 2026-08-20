import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test("'Sono in struttura' è persistente su Supabase e limitato ai manutentori, non più stato locale visibile a tutti", async () => {
  const [app, auth] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/auth-data.js', import.meta.url), 'utf8'),
  ])
  // Non più uno useState locale scollegato dal server.
  assert.doesNotMatch(app, /\[presence, setPresence\] = useState\(true\)/)
  // Deriva da user.in_struttura (già corretto lato server per la scadenza).
  assert.match(app, /const presence = user\.role === 'manutentore' && Boolean\(user\.in_struttura\) && !isPresenceExpired/)
  // Pulsante visibile solo ai manutentori.
  assert.match(app, /\{user\.role === 'manutentore' && <button className=\{`presence \$\{presence \? 'on' : ''\}`\} onClick=\{\(\) => onTogglePresence\(!presence\)\}>/)
  // Nuova funzione client per la scrittura, passa dalla edge function user-pin (stesso pattern del cambio PIN self-service).
  assert.match(auth, /export async function setOwnPresence\(present\) \{/)
  assert.match(auth, /body: \{ action: 'set_presence', present: Boolean\(present\) \}/)
})

test("presenza si spegne da sola dopo 7h20m (PRESENCE_MAX_MS), stessa costante lato client e server", async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /const PRESENCE_MAX_MS = \(7 \* 60 \+ 20\) \* 60 \* 1000/)
  assert.match(app, /const isPresenceExpired = \(since\) => Boolean\(since\) && Date\.now\(\) - since > PRESENCE_MAX_MS/)
  // Timer che spegne automaticamente quando scade, non un controllo passivo soltanto al prossimo reload.
  assert.match(app, /const timer = setTimeout\(\(\) => onTogglePresence\(false\), remaining\)/)
})

test('Avvisi Urgenti mostra quali manutentori sono in struttura ora', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /function UrgentSection\(\{ hotel, user, users, items, openRequest, onCreate, onTake, onComplete, onTransform \}\) \{/)
  assert.match(app, /const presentMaintainers = \(users \|\| \[\]\)\.filter\(\(person\) => person\.role === 'manutentore' && person\.in_struttura\)/)
  assert.match(app, /<div className="urgent-presence">/)
  assert.match(app, /users=\{users\}/)
})
