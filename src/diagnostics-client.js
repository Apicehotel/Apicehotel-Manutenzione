import { supabase, supabaseUrl, supabaseAnonKey } from './supabase.js'
import { loadSession } from './session.js'
import { drainOfflineQueue, getOfflineStatus } from './offline-store.js'
import { enrichDiagnostic } from './diagnostic-taxonomy.js'

const QUEUE_KEY = 'randapp-diagnostics-queue-v1'
const MAX_QUEUE = 50
const MAX_TEXT = 2000
const DEDUPE_MS = 30000
const recent = new Map()

const buildInfo = typeof __RANDAPP_BUILD__ !== 'undefined'
  ? __RANDAPP_BUILD__
  : { sha: 'dev', timestamp: null }

const crop = (value, max = MAX_TEXT) => String(value ?? '').slice(0, max)
const online = () => typeof navigator === 'undefined' || navigator.onLine

export function redactDiagnosticText(value) {
  let text = String(value ?? '')
  const rules = [
    [/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]'],
    [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[JWT REDACTED]'],
    [/\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+\b/gi, '[SUPABASE KEY REDACTED]'],
    [/(authorization|apikey|api_key|token|access_token|refresh_token|password|passwd|pin)\s*[:=]\s*([^\s,;&]+)/gi, '$1=[REDACTED]'],
    [/("(?:authorization|apikey|api_key|token|access_token|refresh_token|password|passwd|pin)"\s*:\s*")[^"]+/gi, '$1[REDACTED]'],
  ]
  for (const [pattern, replacement] of rules) text = text.replace(pattern, replacement)
  return crop(text)
}

function readQueue() {
  try {
    const rows = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    return Array.isArray(rows) ? rows : []
  } catch { return [] }
}
function writeQueue(rows) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-MAX_QUEUE))) } catch {}
}
function enqueue(row) { writeQueue([...readQueue(), row]) }
function fingerprint(row) { return `${row.hotel_id}|${row.kind}|${row.message}|${row.route}` }
function shouldReport(row) {
  const now = Date.now()
  for (const [key, expires] of recent.entries()) if (expires <= now) recent.delete(key)
  const key = fingerprint(row)
  if (recent.has(key)) return false
  recent.set(key, now + DEDUPE_MS)
  return true
}

function payloadFor({ severity = 'error', kind = 'runtime', message, detail = '' } = {}) {
  const session = loadSession()
  if (!session?.hotelId || !message) return null
  return {
    hotel_id: session.hotelId,
    severity: crop(severity, 20),
    kind: crop(kind, 80),
    message: crop(redactDiagnosticText(message), 500),
    detail: crop(redactDiagnosticText(detail)),
    app_build: crop(buildInfo?.sha || 'dev', 80),
    route: typeof location !== 'undefined' ? crop(location.pathname, 300) : null,
    user_agent: typeof navigator !== 'undefined' ? crop(navigator.userAgent, 700) : null,
    created_at: new Date().toISOString(),
  }
}

export async function reportDiagnosticEvent(event) {
  const row = payloadFor(event)
  if (!row || !shouldReport(row)) return false
  if (!supabase || !online()) { enqueue(row); return false }
  try {
    const { error } = await supabase.from('diagnostic_events').insert(row)
    if (error) throw error
    return true
  } catch {
    enqueue(row)
    return false
  }
}

export async function flushDiagnosticEvents() {
  if (!supabase || !online()) return { sent: 0, pending: readQueue().length }
  const queue = readQueue()
  if (!queue.length) return { sent: 0, pending: 0 }
  const remaining = []
  let sent = 0
  for (const queued of queue) {
    const row = { ...queued, message: crop(redactDiagnosticText(queued.message), 500), detail: crop(redactDiagnosticText(queued.detail)) }
    try {
      const { error } = await supabase.from('diagnostic_events').insert(row)
      if (error) throw error
      sent += 1
    } catch { remaining.push(row) }
  }
  writeQueue(remaining)
  return { sent, pending: remaining.length }
}

export function installDiagnosticsCapture() {
  if (typeof window === 'undefined' || window.__randappDiagnosticsInstalled) return
  window.__randappDiagnosticsInstalled = true
  const onError = (event) => reportDiagnosticEvent({
    severity: 'error', kind: 'window-error',
    message: event?.message || 'Errore JavaScript',
    detail: event?.error?.stack || `${event?.filename || ''}:${event?.lineno || ''}:${event?.colno || ''}`,
  })
  const onReject = (event) => {
    const reason = event?.reason
    const message = reason?.message || String(reason || 'Promise rifiutata')
    reportDiagnosticEvent({ severity: 'error', kind: 'unhandled-rejection', message, detail: reason?.stack || '' })
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onReject)
  window.addEventListener('online', flushDiagnosticEvents)
  setTimeout(() => flushDiagnosticEvents(), 1500)
}

async function timed(check, timeoutMs = 5000) {
  const start = performance.now()
  try {
    const value = await Promise.race([
      Promise.resolve().then(check),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
    ])
    return { ok: true, ms: Math.round(performance.now() - start), value }
  } catch (error) {
    return { ok: false, ms: Math.round(performance.now() - start), error: crop(redactDiagnosticText(error?.message || error), 300) }
  }
}

async function serviceWorkerHealth() {
  if (!('serviceWorker' in navigator)) return { supported: false, registered: false, controlled: false }
  const registration = await navigator.serviceWorker.getRegistration()
  return { supported: true, registered: Boolean(registration), controlled: Boolean(navigator.serviceWorker.controller), scope: registration?.scope || null }
}
async function pushHealth() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return { supported: false }
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = registration?.pushManager ? await registration.pushManager.getSubscription() : null
  return { supported: true, permission: Notification.permission, subscribed: Boolean(subscription) }
}
async function supabaseHealth() {
  const response = await fetch(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: supabaseAnonKey } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.status
}
async function authHealth() {
  if (!supabase) throw new Error('Supabase non configurato')
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return Boolean(data?.user)
}

export function getTelemetryReadiness() {
  const env = import.meta.env || {}
  return {
    sentry: { installed: true, configured: Boolean(env.VITE_SENTRY_DSN), enabled: env.VITE_SENTRY_ENABLED === 'true' && Boolean(env.VITE_SENTRY_DSN) },
    opentelemetry: { installed: true, configured: Boolean(env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT), enabled: env.VITE_OTEL_ENABLED === 'true' && Boolean(env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT) },
  }
}

export async function getDiagnosticsSnapshot({ hotelId = loadSession()?.hotelId || null } = {}) {
  const checks = await Promise.all([
    timed(supabaseHealth), timed(authHealth), timed(serviceWorkerHealth), timed(pushHealth), timed(() => getOfflineStatus()),
  ])
  const [api, auth, sw, push, offline] = checks
  const realtimeConnected = Boolean(supabase?.realtime?.isConnected?.())
  let storage = null
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      storage = { usage: estimate.usage || 0, quota: estimate.quota || 0 }
    }
  } catch {}
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true
  const ntfyConfigured = hotelId ? localStorage.getItem(`apicehotel.ntfy.setup.v2.${hotelId}`) === '1' : false
  const ntfyVerified = hotelId ? localStorage.getItem(`apicehotel.ntfy.verified.v2.${hotelId}`) === '1' : false
  return {
    generatedAt: new Date().toISOString(), build: buildInfo, hotelId,
    platform: { online: online(), standalone, userAgent: navigator.userAgent },
    services: {
      supabaseApi: api, auth, realtime: { ok: realtimeConnected, value: realtimeConnected },
      serviceWorker: sw, push, offlineQueue: offline,
      ntfy: { ok: !hotelId || ntfyConfigured, value: { configured: ntfyConfigured, verified: ntfyVerified } },
    },
    telemetry: getTelemetryReadiness(),
    storage, localDiagnosticQueue: readQueue().length,
  }
}

export async function getOperationalHealth(hotelId = loadSession()?.hotelId || null) {
  if (!supabase || !hotelId) return null
  const { data, error } = await supabase.rpc('get_operational_health', { p_hotel_id: hotelId })
  if (error) throw error
  return data || null
}

export async function fetchDiagnosticIncidents(hotelId = loadSession()?.hotelId || null, limit = 20) {
  if (!supabase || !hotelId) return []
  const { data, error } = await supabase.rpc('get_diagnostic_incidents', { p_hotel_id: hotelId, p_limit: limit })
  if (error) throw error
  return (data || []).map((row) => enrichDiagnostic({ ...row, hotel_id: row.hotel_id || hotelId }))
}

export async function retryFailedUrgentJob(hotelId, jobId) {
  if (!supabase || !hotelId || !jobId) return false
  const { data, error } = await supabase.rpc('retry_failed_urgent_job', { p_hotel_id: hotelId, p_job_id: jobId })
  if (error) throw error
  return Boolean(data)
}

export async function repairPushForHotel(hotelId = loadSession()?.hotelId || null) {
  if (!hotelId) return false
  const { repairPushSubscription } = await import('./push.js')
  return repairPushSubscription(hotelId)
}

export async function retryOfflineSync() {
  if (!online()) return { ok: false, reason: 'offline', ...(await getOfflineStatus()) }
  await drainOfflineQueue()
  const status = await getOfflineStatus()
  return { ok: Number(status.blocked || 0) === 0, ...status }
}

export async function fetchRecentDiagnosticEvents(hotelId = null, limit = 30) {
  if (!supabase) return []
  let query = supabase.from('diagnostic_events').select('id,hotel_id,severity,kind,message,detail,app_build,route,user_agent,created_at').order('created_at', { ascending: false }).limit(limit)
  if (hotelId) query = query.eq('hotel_id', hotelId)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(enrichDiagnostic)
}

export async function clearDiagnosticEvents(hotelId = null) {
  if (!supabase) return
  let query = supabase.from('diagnostic_events').delete().lt('created_at', new Date(Date.now() + 1000).toISOString())
  if (hotelId) query = query.eq('hotel_id', hotelId)
  const { error } = await query
  if (error) throw error
}
