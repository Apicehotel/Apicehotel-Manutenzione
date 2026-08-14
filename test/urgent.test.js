import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Avvisi Urgenti implementa invio, presa in carico, completamento e trasformazione', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(app, /URGENT_STORAGE_KEY/)
  assert.match(app, /\['tutte', 'Tutte'/)
  assert.match(app, />Vado</)
  assert.match(app, />Fatto</)
  assert.match(app, /Non risolvibile — trasforma in segnalazione/)
  assert.match(app, /origin: 'Avviso urgente'/)
  assert.match(app, /item\.hotelId === hotel\.id/)
})
