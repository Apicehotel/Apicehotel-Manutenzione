import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260905100000_randchat_group_b_e2ee_dm.sql')
const hardening = read('supabase/migrations/20260905100100_randchat_group_b_hardening.sql')
const cryptoCore = read('src/randapp/chat/dm-crypto-core.js')
const deviceStore = read('src/randapp/chat/dm-device-store.js')
const dmData = read('src/randapp/chat/dm-data.js')
const chatUi = read('src/randapp/chat/RandChat.jsx')
const chatThread = read('src/randapp/chat/RandChatThread.jsx')
const chatList = read('src/randapp/chat/RandChatList.jsx')
const promote = read('src/randapp/chat/PromoteIssueDialog.jsx')

test('DM storage is ciphertext-only with device envelopes', () => {
  const messagesTable = migration.match(/create table if not exists public\.chat_dm_messages[\s\S]*?\n\);/)?.[0] || ''
  assert.match(messagesTable, /ciphertext text not null/i)
  assert.match(messagesTable, /content_iv text not null/i)
  assert.match(messagesTable, /ephemeral_public_key_jwk jsonb not null/i)
  assert.match(messagesTable, /signature text not null/i)
  assert.doesNotMatch(messagesTable, /\bbody\b|plaintext/i)
  assert.match(migration, /create table if not exists public\.chat_dm_envelopes/i)
  assert.match(migration, /wrapped_key text not null/i)
})

test('DM retention is limited to 1, 7 or 15 days and cleanup removes expired ciphertext', () => {
  assert.match(migration, /retention_days in \(1, 7, 15\)/i)
  assert.match(migration, /expires_at<=now\(\)/i)
  assert.match(migration, /randchat-dm-retention-hourly/i)
})

test('server requires a key envelope for every active device of both participants', () => {
  const send = migration.match(/create or replace function public\.chat_dm_send_message[\s\S]*?create or replace function public\.chat_dm_list_messages/)?.[0] || ''
  assert.match(send, /v_active_users < 2/i)
  assert.match(send, /v_input_count <> v_active_count/i)
  assert.match(send, /Envelope mancante per un dispositivo attivo/i)
  assert.match(send, /Dispositivo mittente non registrato/i)
})

test('private device keys are generated client-side and stored outside Supabase', () => {
  assert.match(cryptoCore, /generateDeviceCryptoIdentity/)
  assert.match(cryptoCore, /ECDH/)
  assert.match(cryptoCore, /ECDSA/)
  assert.match(cryptoCore, /AES-GCM/)
  assert.match(cryptoCore, /importKey\('jwk', privateJwk, algorithm, false/)
  assert.match(deviceStore, /indexedDB\.open\(DB_NAME/)
  assert.match(deviceStore, /device-identities/)
  assert.doesNotMatch(dmData, /encryptionPrivateKey.*rpc|signingPrivateKey.*rpc/i)
  assert.match(dmData, /p_encryption_public_key_jwk/)
  assert.match(dmData, /p_signing_public_key_jwk/)
})

test('messages are signed, verified and decrypted only in the client crypto layer', () => {
  assert.match(cryptoCore, /subtle\(\)\.deriveKey|cryptoApi\.deriveKey/)
  assert.match(cryptoCore, /cryptoApi\.sign/)
  assert.match(cryptoCore, /cryptoApi\.verify/)
  assert.match(dmData, /encryptDmPayload/)
  assert.match(dmData, /decryptDmPayload/)
  assert.match(chatThread, /Firma e cifratura verificate/)
})

test('promotion to persistent Segnalazione is explicit and stores only a metadata source link', () => {
  const linksTable = migration.match(/create table if not exists public\.chat_issue_links[\s\S]*?\n\);/)?.[0] || ''
  assert.doesNotMatch(linksTable, /\bbody\b|plaintext|ciphertext/i)
  assert.match(migration, /chat_link_issue/)
  assert.match(promote, /insertIssue/)
  assert.match(promote, /origin: 'RandChat'/)
  assert.match(promote, /linkChatMessageToIssue/)
  assert.match(chatThread, /Crea segnalazione/)
})

test('replacement RandChat runtime keeps groups and encrypted directs in one messenger', () => {
  assert.match(chatUi, /fetchChatGroups/)
  assert.match(chatUi, /fetchDmThreads/)
  assert.match(chatList, /Gruppi/)
  assert.match(chatList, /Diretti/)
})

test('device registration hardening preserves public-key identity instead of silently rotating it', () => {
  assert.match(hardening, /is distinct from p_encryption_public_key_jwk/i)
  assert.match(hardening, /Identità crittografica dispositivo non corrispondente/i)
  assert.match(hardening, /return v_device_row_id/i)
})
