import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test("insertUrgent non nasconde più gli errori: logga (come HotelGio) e lancia invece di restituire null in silenzio", async () => {
  const urgents = await readFile(new URL('../src/urgents-data.js', import.meta.url), 'utf8')
  assert.match(urgents, /export async function insertUrgent\(item\) \{\n  if \(!supabase\) throw new Error\('Supabase non configurato'\)\n  const \{ data, error \} = await supabase\.from\('richieste_urgenti'\)\.insert\(toRow\(item\)\)\.select\(\)\.single\(\)\n  if \(error\) \{ console\.error\('insertUrgent', error\); throw new Error\(error\.message\) \}/)
  assert.doesNotMatch(urgents, /catch \{ return null \}/)
})

test("il form Avvisi Urgenti mostra l'errore reale e non chiude più il form come se fosse riuscito quando la creazione fallisce", async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  // Prima: send() chiudeva SEMPRE il form (setCreating(false)) subito dopo aver chiamato
  // onCreate, senza aspettarne l'esito — un fallimento silenzioso sembrava un successo.
  assert.match(app, /const send = async \(event\) => \{/)
  assert.match(app, /try \{\n      await onCreate\(text\)\n      setNote\(''\); setCreating\(false\); setFilter\('attesa'\)\n    \} catch \(error\) \{\n      setSendError\(error\?\.message \|\| 'Invio non riuscito, riprova'\)/)
  assert.match(app, /\{sendError && <p className="notice">\{sendError\}<\/p>\}/)
  assert.match(app, /disabled=\{!note\.trim\(\) \|\| sending\}>\{sending \? 'Invio…' : 'Invia avviso urgente'\}/)
})
