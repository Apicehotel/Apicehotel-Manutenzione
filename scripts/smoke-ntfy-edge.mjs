#!/usr/bin/env node
/**
 * Live smoke probe for ntfy edge functions (no secrets).
 * Exit 0 when ntfy-admin is published (401/403 without auth is OK; 404 is fail).
 */
const BASE = process.env.SUPABASE_URL || 'https://ooqlfldcrnkudhgjnied.supabase.co'
const NTFY = process.env.NTFY_SERVER || 'https://ntfy.sh'

async function probe(name) {
  const response = await fetch(`${BASE}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hotel_id: 'hotelgio', action: 'status' }),
  })
  let body = ''
  try { body = await response.text() } catch {}
  return { name, status: response.status, body: body.slice(0, 180) }
}

async function probeNtfyPublish() {
  const topic = `randapp-smoke-${Date.now().toString(36)}`
  const response = await fetch(NTFY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, title: 'RandApp smoke', message: 'probe', priority: 1 }),
  })
  return { name: 'ntfy.sh publish', status: response.status, body: (await response.text()).slice(0, 120), topic }
}

const required = ['ntfy-config', 'ntfy-alert', 'ntfy-resolve', 'ntfy-admin']
const results = []
for (const name of required) results.push(await probe(name))
results.push(await probeNtfyPublish())

let failed = false
for (const row of results) {
  const ok = row.name === 'ntfy.sh publish'
    ? row.status >= 200 && row.status < 300
    : row.status !== 404
  if (!ok) failed = true
  console.log(`${ok ? 'OK ' : 'FAIL'} ${row.name.padEnd(22)} HTTP ${row.status}  ${row.body}`)
}

if (failed) {
  console.error('\nntfy-admin (or another function) is missing on Supabase. Run: bash scripts/deploy-ntfy-edge.sh')
  process.exit(1)
}

console.log('\nEdge functions are reachable. Authenticated admin/operator tests still need a live session.')
