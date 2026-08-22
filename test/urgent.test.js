import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Avvisi Urgenti implementa invio, presa in carico, completamento e trasformazione', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

  assert.match(app, /subscribeUrgents/)
  assert.match(app, /\['tutte', 'Tutte'/)
  assert.match(app, />Vado</)
  assert.match(app, />Fatto</)
  assert.match(app, /Non risolvibile — trasforma in segnalazione/)
  assert.match(app, /origin: 'Avviso urgente'/)
  assert.match(app, /item\.hotelId === hotel\.id/)
  assert.match(app, /function UrgentBanner/)
  assert.match(app, /className="fab-new-issue planned-fab urgent-fab-scoped"/)
  assert.match(app, /const canSendUrgent = \(user\) => \['admin', 'Direzione', 'Direttore Centro Congressi', 'Reception'\]\.includes\(user\.role\)/)
  assert.match(app, /const canManageUrgent = \(user\) => \['admin', 'manutentore', 'Direttore Centro Congressi', 'Portiere Notturno', 'Reception'\]\.includes\(user\.role\)/)
  assert.match(app, /const canViewUrgent = \(user\) => canSendUrgent\(user\) \|\| canManageUrgent\(user\)/)
  assert.match(app, /\.\.\.\(canViewUrgent\(user\) \? \['Avvisi Urgenti'\] : \[\]\)/)
  assert.match(app, /navigator\.vibrate/)
  assert.match(app, /Trasforma in segnalazione/)
  assert.match(app, /Categoria obbligatoria/)
  assert.match(app, /Gravità obbligatoria/)
})
