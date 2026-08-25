import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Planning Sale non usa più localStorage: fetch iniziale + tempo reale via Supabase, stesso pattern di segnalazioni/interventi', async () => {
  const [planning, app] = await Promise.all([
    readFile(new URL('../src/planning.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(planning, /localStorage/)
  assert.doesNotMatch(planning, /SALE_KEY/)
  assert.match(planning, /import \{ fetchBookings, insertBooking, updateBookingRow, deleteBookingRow, subscribeBookings \} from '\.\/sale-data\.js'/)
  assert.match(planning, /const refresh=async\(\)=>\{const \{items\}=await fetchBookings\(hotel\.id\);setBookings\(items\)\}/)
  assert.match(planning, /useEffect\(\(\)=>\{refresh\(\);const unsub=subscribeBookings\(hotel\.id,refresh\);return unsub\},\[hotel\.id\]\)/)
  assert.match(app, /<PlanningSale hotel=\{hotel\} user=\{user\} openRequest=\{saleComposeRequest\} \/>/)
})

test('src/sale-data.js: stesso ponte app<->riga DB già usato per interventi/avvisi urgenti, mappa lo stato a 3 livelli', async () => {
  const source = await readFile(new URL('../src/sale-data.js', import.meta.url), 'utf8')
  assert.match(source, /export async function fetchBookings\(hotelId\)\s*\{/)
  assert.match(source, /export async function insertBooking\(item\)\s*\{/)
  assert.match(source, /export async function updateBookingRow\(id\s*,\s*changes\)\s*\{/)
  assert.match(source, /export async function deleteBookingRow\(id\)\s*\{/)
  assert.match(source, /export function subscribeBookings\(hotelId\s*,\s*onChange\)\s*\{/)
  assert.match(source, /status\s*:\s*row\.stato\s*\|\|\s*'pending'/)
  assert.match(source, /toFinishBy\s*:\s*row\.da_finire_da\s*\|\|\s*null/)
  assert.match(source, /doneBy\s*:\s*row\.completata_da\s*\|\|\s*null/)
})

test('Feedback non è più solo locale: invio su Supabase, visibile agli admin in tempo reale', async () => {
  const [app, feedbackData] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/feedback-data.js', import.meta.url), 'utf8'),
  ])
  assert.doesNotMatch(app, /FEEDBACK_STORAGE_KEY/)
  assert.match(app, /await insertFeedback\(hotel\.id, user\.name, text\)/)
  assert.match(app, /function FeedbackAdminSection\(\{ hotel \}\) \{/)
  assert.match(app, /const refresh = async \(\) => \{ const \{ items: rows \} = await fetchFeedback\(hotel\.id\); setItems\(rows\) \}/)
  assert.match(app, /useEffect\(\(\) => \{ refresh\(\); const unsub = subscribeFeedback\(hotel\.id, refresh\); return unsub \}, \[hotel\.id\]\)/)
  // Visibile solo agli admin, raggiungibile da Altro.
  assert.match(app, /\{user\.role === 'admin' && <button onClick=\{\(\) => \{ setTab\('Feedback ricevuti'\); setMenuOpen\(false\) \}\}>/)
  assert.match(feedbackData, /export async function insertFeedback\(hotelId\s*,\s*userName\s*,\s*text\)\s*\{/)
  assert.match(feedbackData, /export async function fetchFeedback\(hotelId\)\s*\{/)
  assert.match(feedbackData, /export function subscribeFeedback\(hotelId\s*,\s*onChange\)\s*\{/)
})
