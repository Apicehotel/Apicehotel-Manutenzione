import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync(new URL('../supabase/migrations/20260919143000_telegram_backup_ticket_codes.sql', import.meta.url), 'utf8')
const telegram = fs.readFileSync(new URL('../supabase/functions/telegram-backup/index.ts', import.meta.url), 'utf8')
const issuesData = fs.readFileSync(new URL('../src/issues-data.js', import.meta.url), 'utf8')
const plannedData = fs.readFileSync(new URL('../src/planned-data.js', import.meta.url), 'utf8')
const issuesUi = fs.readFileSync(new URL('../src/randapp/Issues.jsx', import.meta.url), 'utf8')
const interventionsUi = fs.readFileSync(new URL('../src/randapp/operations/InterventionsView.jsx', import.meta.url), 'utf8')

test('ticket codes use hotel prefixes and independent counters for issues/interventions', () => {
  assert.match(migration, /when 'hotelgio' then 'HG'/)
  assert.match(migration, /when 'chocohotel' then 'HC'/)
  assert.match(migration, /when 'brigantino' then 'HB'/)
  assert.match(migration, /trg_segnalazioni_ticket/)
  assert.match(migration, /trg_interventi_ticket/)
  assert.match(migration, /lpad\(v_number::text, 4, '0'\)/)
})

test('Telegram backup routes every hotel and workflow to configured topics', () => {
  for (const name of [
    'TELEGRAM_TOPIC_HG_SEGNALAZIONI','TELEGRAM_TOPIC_HC_SEGNALAZIONI','TELEGRAM_TOPIC_HB_SEGNALAZIONI',
    'TELEGRAM_TOPIC_HG_INTERVENTI','TELEGRAM_TOPIC_HC_INTERVENTI','TELEGRAM_TOPIC_HB_INTERVENTI',
  ]) assert.match(telegram, new RegExp(name))
  assert.match(telegram, /TELEGRAM_BACKUP_CHAT_ID/)
  assert.match(telegram, /sendPhoto/)
  assert.match(telegram, /sendVideo/)
  assert.match(telegram, /message_thread_id/)
  assert.match(telegram, /#camera/)
})

test('RandApp exposes ticket codes and triggers non-blocking Telegram backup', () => {
  assert.match(issuesData, /ticketCode:row\.ticket_code/)
  assert.match(issuesData, /telegram-backup/)
  assert.match(plannedData, /ticketCode:row\.ticket_code/)
  assert.match(plannedData, /telegram-backup/)
  assert.match(issuesUi, /issue\.ticketCode/)
  assert.match(interventionsUi, /item\.ticketCode/)
})
