import { isAuthorized, getInstallationAccess } from '../_lib/github-app.js'

const OWNER = 'Apicehotel'
const REPO = 'Apicehotel-Manutenzione'
const API_ROOT = 'https://api.github.com'

async function github(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'apicehotel-maintenance-bridge',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()

  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    const error = new Error(`GitHub API ${response.status}`)
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

function isSafePath(path) {
  if (!path || typeof path !== 'string') return false

  if (
    path.startsWith('/') ||
    path.includes('..') ||
    path.includes('\\')
  ) {
    return false
  }

  const allowedPrefixes = [
    'src/',
    'api/',
    'supabase/',
    'public/',
    'tests/',
  ]

  const allowedRootFiles = [
    'package.json',
    'vite.config.js',
    'vercel.json',
    'README.md',
  ]

  return (
    allowedPrefixes.some((prefix) => path.startsWith(prefix)) ||
    allowedRootFiles.includes(path)
  )
}

function isSafeBranch(branch) {
  if (!branch || typeof branch !== 'string') return false

  return /^[a-zA-Z0-9._/-]+$/.test(branch)
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')

  if (request.method !== 'POST') {
    return response.status(405).json({
      ok: false,
      error: 'method_not_allowed',
    })
  }

  if (
    !isAuthorized(
      request,
      process.env.GITHUB_BRIDGE_SECRET
    )
  ) {
    return response.status(401).json({
      ok: false,
      error: 'unauthorized',
    })
  }

  try {
    const {
      path,
      content,
      message,
      branch = 'main',
    } = request.body || {}

    if (!isSafePath(path)) {
      return response.status(400).json({
        ok: false,
        error: 'invalid_path',
      })
    }

    if (!isSafeBranch(branch)) {
      return response.status(400).json({
        ok: false,
        error: 'invalid_branch',
      })
    }

    if (
      typeof content !== 'string' ||
      typeof message !== 'string' ||
      !message.trim()
    ) {
      return response.status(400).json({
        ok: false,
        error: 'invalid_payload',
      })
    }

    const access = await getInstallationAccess()

    let current = null

    try {
      current = await github(
        `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
        {
          token: access.token,
        }
      )
    } catch (error) {
      if (error.status !== 404) throw error
    }

    const body = {
      message: message.trim(),
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
    }

    if (current?.sha) {
      body.sha = current.sha
    }

    const result = await github(
      `/repos/${OWNER}/${REPO}/contents/${path}`,
      {
        method: 'PUT',
        token: access.token,
        body,
      }
    )

    return response.status(200).json({
      ok: true,
      action: current?.sha ? 'updated' : 'created',
      path,
      branch,
      commitSha: result?.commit?.sha || null,
      contentSha: result?.content?.sha || null,
    })
  } catch (error) {
    console.error(
      'GitHub bridge write-file failed',
      error instanceof Error ? error.message : error
    )

    return response.status(502).json({
      ok: false,
      error: 'github_write_failed',
    })
  }
}
