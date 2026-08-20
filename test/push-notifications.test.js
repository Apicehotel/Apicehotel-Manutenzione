import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('src/push.js: iscrizione/disiscrizione push verso la chiave VAPID pubblica e push-subscribe', async () => {
  const push = await readFile(new URL('../src/push.js', import.meta.url), 'utf8')
  assert.match(push, /const VAPID_PUBLIC_KEY = 'BJXvALpVtVoEJ4Kuc0AydxwS27BiC43JrMNY0eycS3Ih-75GPbVUfL5B5hs7jCRlWDaAkidMOndZUiZ0Norjxlk'/)
  assert.match(push, /export async function subscribeToPush\(hotelId\) \{/)
  assert.match(push, /export async function unsubscribeFromPush\(hotelId\) \{/)
  assert.match(push, /supabase\.functions\.invoke\('push-subscribe', \{/)
})

test('MenuPanel: il pannello Notifiche mostra lo stato reale dell\'iscrizione, non solo il permesso browser', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /function MenuPanel\(\{ type, user, hotel, onClose, onSavePin, onSaveProfile \}\) \{/)
  assert.match(app, /getPushSubscriptionState\(\)\.then\(\(state\) => \{ if \(active\) setPushState\(state\) \}\)/)
  assert.match(app, /const toggleNotifications = async \(\) => \{/)
  assert.match(app, /await subscribeToPush\(hotel\.id\)/)
  assert.match(app, /await unsubscribeFromPush\(hotel\.id\)/)
  assert.match(app, /hotel=\{hotel\} onClose=\{\(\) => setMenuPanel\(null\)\}/)
})

test('avviso urgente creato: notifyUrgent chiamata dopo il salvataggio riuscito, verso send-push', async () => {
  const [app, urgents] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/urgents-data.js', import.meta.url), 'utf8'),
  ])
  assert.match(app, /if \(created\) \{ setUrgentItems\(\(list\) => \[created, \.\.\.list\.filter\(\(i\) => i\.id !== created\.id\)\]\); notifyUrgent\(hotel\.id, text\) \}/)
  assert.match(urgents, /export async function notifyUrgent\(hotelId, note\) \{/)
  assert.match(urgents, /supabase\.functions\.invoke\('send-push', \{ body: \{ hotel_id: hotelId, title: 'Avviso urgente', body: note \} \}\)/)
})

test('service worker: gestori push e notificationclick presenti, versione cache aggiornata', async () => {
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')
  assert.match(sw, /const CACHE_NAME = 'apicehotel-manutenzione-v3'/)
  assert.match(sw, /self\.addEventListener\('push', \(event\) => \{/)
  assert.match(sw, /self\.registration\.showNotification\(payload\.title, \{/)
  assert.match(sw, /self\.addEventListener\('notificationclick', \(event\) => \{/)
})
