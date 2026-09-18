import { createClient } from '@supabase/supabase-js'
import { writeAgentHeartbeat } from './rand-agent-heartbeat.mjs'

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

const agentId = arg('agent')
const status = String(arg('status', 'RUNNING') || 'RUNNING').toUpperCase()
const activity = arg('activity')
const detail = arg('detail')
const taskId = arg('task-id', process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_WORKFLOW || 'github'}:${process.env.GITHUB_RUN_ID}` : null)

if (!agentId) {
  console.error('Missing --agent')
  process.exit(2)
}

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.log('::notice title=Rand heartbeat not sent::SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured for this runner.')
  process.exit(0)
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const result = await writeAgentHeartbeat({
  supabase,
  agentId,
  status,
  taskId: status === 'IDLE' ? null : taskId,
  activity,
  detail,
  metadata: {
    source: 'github-actions',
    workflow: process.env.GITHUB_WORKFLOW || null,
    run_id: process.env.GITHUB_RUN_ID || null,
    run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
    ref: process.env.GITHUB_REF || null,
    sha: process.env.GITHUB_SHA || null,
  },
})

if (process.env.GITHUB_OUTPUT) {
  const fs = await import('node:fs')
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `may_start_new_task=${result.mayStartNewTask ? 'true' : 'false'}\n`)
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `desired_state=${result.desiredState}\n`)
}

console.log(`Rand heartbeat: ${result.agentId} ${status} desired=${result.desiredState}`)
