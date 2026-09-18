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

const url = process.env.SUPABASE_URL || 'https://ooqlfldcrnkudhgjnied.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function writeViaGithubOidc() {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  if (!requestUrl || !requestToken) return null

  const oidcResponse = await fetch(`${requestUrl}&audience=randcore-heartbeat`, {
    headers: { Authorization: `Bearer ${requestToken}` },
  })
  if (!oidcResponse.ok) throw new Error(`GitHub OIDC token request failed: ${oidcResponse.status}`)
  const { value: oidcToken } = await oidcResponse.json()

  const response = await fetch(`${url}/functions/v1/randcore-agent-heartbeat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${oidcToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agentId,
      status,
      taskId: status === 'IDLE' ? null : taskId,
      activity,
      detail,
      metadata: {
        workflow: process.env.GITHUB_WORKFLOW || null,
        run_id: process.env.GITHUB_RUN_ID || null,
        run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
        ref: process.env.GITHUB_REF || null,
        sha: process.env.GITHUB_SHA || null,
      },
    }),
  })
  if (!response.ok) throw new Error(`Heartbeat edge function failed: ${response.status} ${await response.text()}`)
  return response.json()
}

let result

if (serviceRoleKey) {
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  result = await writeAgentHeartbeat({
    supabase,
    agentId,
    status,
    taskId: status === 'IDLE' ? null : taskId,
    activity,
    detail,
    metadata: {
      source: 'github-actions-service-role',
      workflow: process.env.GITHUB_WORKFLOW || null,
      run_id: process.env.GITHUB_RUN_ID || null,
      run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
      ref: process.env.GITHUB_REF || null,
      sha: process.env.GITHUB_SHA || null,
    },
  })
} else {
  result = await writeViaGithubOidc()
  if (!result) {
    console.log('::notice title=Rand heartbeat not sent::No service-role secret and GitHub OIDC is unavailable on this runner.')
    process.exit(0)
  }
}

if (process.env.GITHUB_OUTPUT) {
  const fs = await import('node:fs')
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `may_start_new_task=${result.mayStartNewTask ? 'true' : 'false'}\n`)
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `desired_state=${result.desiredState}\n`)
}

console.log(`Rand heartbeat: ${result.agentId} ${status} desired=${result.desiredState}`)
