#!/usr/bin/env node
/**
 * Backfill storico HotelGio -> Telegram.
 * Legge dal vecchio progetto Supabase HotelGio e pubblica nel topic HG Segnalazioni.
 * Idempotente: usa telegram_history_backfill_state per non creare doppioni.
 */

const required = [
  'OLD_HOTELGIO_SUPABASE_URL',
  'OLD_HOTELGIO_SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_BACKUP_CHAT_ID',
  'TELEGRAM_TOPIC_HG_SEGNALAZIONI',
]
for (const key of required) {
  if (!process.env[key]) throw new Error(`Variabile mancante: ${key}`)
}

const BASE = process.env.OLD_HOTELGIO_SUPABASE_URL.replace(/\/$/, '')
const SERVICE = process.env.OLD_HOTELGIO_SUPABASE_SERVICE_ROLE_KEY
const BOT = process.env.TELEGRAM_BOT_TOKEN
const CHAT = process.env.TELEGRAM_BACKUP_CHAT_ID
const THREAD = Number(process.env.TELEGRAM_TOPIC_HG_SEGNALAZIONI)

const headers = {
  apikey: SERVICE,
  authorization: `Bearer ${SERVICE}`,
  'content-type': 'application/json',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const cleanTag = (v='') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_]/g,'')
const roomTag = (room='') => {
  const m = String(room).match(/(\d{1,4})/)
  return m ? `#camera${m[1]}` : ''
}

async function sb(path, init={}) {
  const res = await fetch(BASE + path, { ...init, headers: { ...headers, ...(init.headers||{}) } })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0,300)}`)
  return text ? JSON.parse(text) : null
}

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.description || 'Telegram error')
  return json.result
}

async function sendDataUrl(dataUrl, caption) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/s)
  if (!m) throw new Error('Formato immagine storico non valido')
  const mime = m[1]
  const bytes = Buffer.from(m[2], 'base64')
  const form = new FormData()
  form.append('chat_id', CHAT)
  form.append('message_thread_id', String(THREAD))
  form.append('caption', caption.slice(0,1024))
  form.append('photo', new Blob([bytes], { type: mime }), 'hotelgio.jpg')
  const res = await fetch(`https://api.telegram.org/bot${BOT}/sendPhoto`, { method:'POST', body:form })
  const json = await res.json()
  if (!json.ok) throw new Error(json.description || 'Telegram photo error')
  return json.result
}

function caption(row, ticket, phase) {
  const loc = String(row.camera || '').trim()
  const cat = String(row.categoria || 'manutenzione').trim()
  const note = String(row.note || '').trim()
  const who = String(row.creato_da || 'Non indicato').trim()
  const resolvedBy = String(row.completato_da || 'Non indicato').trim()
  const when = row.creato_il ? new Date(row.creato_il).toLocaleString('it-IT', { timeZone:'Europe/Rome' }) : ''
  const doneWhen = row.completato_il ? new Date(row.completato_il).toLocaleString('it-IT', { timeZone:'Europe/Rome' }) : ''

  const lines = [
    `${ticket} · ${loc || 'Hotel Giò'}`,
    note || cat,
    when ? `Segnalata il: ${when}` : '',
    `Segnalata da: ${who}`,
  ]
  if (phase === 'after') {
    lines.push(`Risolta da: ${resolvedBy}`)
    if (doneWhen) lines.push(`Risolta il: ${doneWhen}`)
  }
  lines.push('')
  lines.push([
    '#' + cleanTag(ticket.replace(/-/g,'')),
    roomTag(loc),
    '#hg',
    '#' + cleanTag(cat.toLowerCase()),
    phase === 'before' ? '#prima' : '#dopo',
    '#storico',
  ].filter(Boolean).join(' '))
  return lines.filter((x,i,a)=>x || (i>0 && i<a.length-1)).join('\n')
}

async function main() {
  const rows = await sb('/rest/v1/segnalazioni?select=id,camera,categoria,note,foto_prima,foto_dopo,creato_da,creato_il,completato_da,completato_il&or=(foto_prima.not.is.null,foto_dopo.not.is.null)&order=creato_il.asc')
  const tickets = await sb('/rest/v1/telegram_history_ticket_map?select=issue_id,ticket_code')
  const states = await sb('/rest/v1/telegram_history_backfill_state?select=*')
  const ticketBy = new Map(tickets.map(x=>[x.issue_id,x.ticket_code]))
  const stateBy = new Map(states.map(x=>[x.issue_id,x]))

  let sent = 0
  for (const row of rows) {
    const ticket = ticketBy.get(row.id)
    const state = stateBy.get(row.id) || {}
    if (!ticket) continue

    if (row.foto_prima && !state.before_sent) {
      const msg = await sendDataUrl(row.foto_prima, caption(row,ticket,'before'))
      await sb(`/rest/v1/telegram_history_backfill_state?issue_id=eq.${row.id}`, {
        method:'PATCH',
        headers:{ Prefer:'return=minimal' },
        body:JSON.stringify({ before_sent:true, before_message_id:msg.message_id, updated_at:new Date().toISOString() }),
      })
      sent++
      await sleep(1100)
    }

    if (row.foto_dopo && !state.after_sent) {
      const msg = await sendDataUrl(row.foto_dopo, caption(row,ticket,'after'))
      await sb(`/rest/v1/telegram_history_backfill_state?issue_id=eq.${row.id}`, {
        method:'PATCH',
        headers:{ Prefer:'return=minimal' },
        body:JSON.stringify({ after_sent:true, after_message_id:msg.message_id, updated_at:new Date().toISOString() }),
      })
      sent++
      await sleep(1100)
    }
  }
  console.log(`Backfill completato. Messaggi inviati: ${sent}`)
}

main().catch((err)=>{ console.error(err); process.exit(1) })
