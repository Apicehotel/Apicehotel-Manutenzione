import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test("insertUrgent conserva gli errori reali ma mette in coda solo i problemi di rete/offline", async () => {
  const urgents = await readFile(new URL('../src/urgents-data.js', import.meta.url), 'utf8')
  assert.match(urgents, /export async function insertUrgent\(item\)/)
  assert.match(urgents, /if\(!supabase\|\|!onlineNow\(\)\).*enqueueMutation/)
  assert.match(urgents, /catch\(error\)\{if\(isTransientNetworkError\(error\)\).*enqueueMutation/)
  assert.match(urgents, /operationFailed\(error,'Avviso urgente non salvato'\);throw error/)
  assert.match(urgents, /_notifyOnSync:true/)
  assert.doesNotMatch(urgents, /catch\s*\{\s*return null\s*\}/)
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
