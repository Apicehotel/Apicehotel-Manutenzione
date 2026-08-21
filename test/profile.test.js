import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('profilo personale: nuova voce "Il mio profilo" nel drawer, form dedicato in MenuPanel', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /<button onClick=\{\(\) => openPanel\('profile'\)\}><Icon name="user" \/><span>Il mio profilo<\/span><\/button>/)
  assert.match(app, /profile: 'Il mio profilo'/)
  assert.match(app, /\{type === 'profile' && <><form onSubmit=\{saveProfile\}>/)
})

test('profilo personale: il salvataggio passa da updateUserRow sull\'utente corrente, poi ricarica la directory', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /const updateCurrentUserProfile = async \(changes\) => \{ await updateUserRow\(user\.auth_user_id \|\| user\.id, changes\); await loadDirectory\(selectedHotel\.id\) \}/)
  assert.match(app, /onSaveProfile=\{updateCurrentUserProfile\}/)
  assert.match(app, /onSaveProfile=\{onSaveProfile\}/)
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
