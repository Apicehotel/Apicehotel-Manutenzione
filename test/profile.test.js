import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('profilo personale: nuova voce "Il mio profilo" nel drawer, ora pagina piena (non più popup)', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /<button onClick=\{\(\) => \{ setTab\('Il mio profilo'\); setMenuOpen\(false\) \}\}><Icon name="user" \/><span>Il mio profilo<\/span><\/button>/)
  assert.match(app, /\['Il mio profilo','Cambia PIN','Manuale','Feedback'\]\.includes\(tab\) \? <MenuPanel type=\{tab\}/)
  assert.match(app, /\{type === 'Il mio profilo' && <><form onSubmit=\{saveProfile\}>/)
})

test('profilo personale: il salvataggio passa da updateOwnProfile (self-service, no admin) sull\'utente corrente, poi ricarica la directory', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /const updateCurrentUserProfile = async \(changes\) => \{ await updateOwnProfile\(\{ email: changes\.email, phone: changes\.phone, phoneCountryCode: changes\.phone_country_code \}\); await loadDirectory\(selectedHotel\.id\) \}/)
  assert.match(app, /onSaveProfile=\{updateCurrentUserProfile\}/)
  assert.match(app, /onSaveProfile=\{onSaveProfile\}/)
})

test('profilo personale: il nome non è modificabile dall\'utente, solo da un admin', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /<label>Nome<input aria-label="Nome" value=\{user\?\.name \|\| ''\} disabled readOnly/)
  const authData = await readFile(new URL('../src/auth-data.js', import.meta.url), 'utf8')
  assert.match(authData, /export async function updateOwnProfile\(/)
  assert.doesNotMatch(authData.match(/export async function updateOwnProfile[\s\S]*?\n\}/)[0], /\bname\b/)
})

test('admin panel: pulsante Modifica per nome/email/telefono di ogni utente', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /const startEdit = \(target\) => \{ setEditingId\(target\.id\); setEditDraft\(\{ name: target\.name \|\| '', email: target\.email \|\| '', phone: target\.phone \|\| '' \}\) \}/)
  assert.match(app, /const saveEdit = async \(target\) => \{ if \(!editDraft\.name\.trim\(\)\) return setMessage\('Il nome non può essere vuoto'\); await saveChange\(target, \{ name: editDraft\.name\.trim\(\), email: editDraft\.email\.trim\(\) \|\| null, phone: editDraft\.phone\.trim\(\) \|\| null \}\); setEditingId\(null\) \}/)
  assert.match(app, /<button onClick=\{\(\)=>startEdit\(target\)\}>Modifica<\/button>/)
  // Nessuna funzione esistente rimossa: PIN e Disattiva restano.
  assert.match(app, /<button onClick=\{\(\)=>resetPin\(target\)\} disabled=\{target\.protected\}>PIN<\/button>/)
  assert.match(app, /<button className="delete-user" onClick=\{\(\)=>deactivate\(target\)\} disabled=\{target\.protected\}>Disattiva<\/button>/)
})
