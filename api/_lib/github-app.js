import { createSign, timingSafeEqual } from 'node:crypto'

const API_ROOT = 'https://api.github.com'
const TARGET_REPO = 'Apicehotel/Apicehotel-Manutenzione'

function encode(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64url')
}

export function createAppJwt({ appId, privateKey, now = Math.floor(Date.now() / 1000) }) {
  if (!appId || !privateKey) throw new Error('Configurazione GitHub App incompleta')
  const header = encode({ alg: 'RS256', typ: 'JWT' })
  const payload = encode({ iat: now - 60, exp: now + 540, iss: appId })
  const input = `${header}.${payload}`
  const signer = createSign('RSA-SHA256')
  signer.update(input)
  signer.end()
  const signature = signer.sign(privateKey.replace(/\\n/g, '\n'), 'base64url')
  return `${input}.${signature}`
}

export function isAuthorized(request, expectedSecret) {
  if (!expectedSecret) return false
  const authorization = request.headers.authorization || ''
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : request.headers['x-github-bridge-key']
  if (!provided) return false
  const left = Buffer.from(provided)
  const right = Buffer.from(expectedSecret)
  return left.length === right.length && timingSafeEqual(left, right)
}

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
  if (!response.ok) throw new Error(`GitHub API ${response.status}`)
  return response.json()
}

export async function getInstallationAccess() {
  const configuredRepo = process.env.GITHUB_REPO || TARGET_REPO
  if (configuredRepo !== TARGET_REPO) throw new Error('Repository GitHub non consentito')
  const appJwt = createAppJwt({ appId: process.env.GITHUB_APP_ID, privateKey: process.env.GITHUB_APP_PRIVATE_KEY })
  const installation = await github('/repos/Apicehotel/Apicehotel-Manutenzione/installation', { token: appJwt })
  const access = await github(`/app/installations/${installation.id}/access_tokens`, {
    method: 'POST', token: appJwt, body: { repositories: ['Apicehotel-Manutenzione'], permissions: { metadata: 'read', contents: 'read' } },
  })
  return { token: access.token, expiresAt: access.expires_at }
}

export async function testRepositoryRead() {
  const access = await getInstallationAccess()
  const repository = await github('/repos/Apicehotel/Apicehotel-Manutenzione', { token: access.token })
  return { repository: repository.full_name, defaultBranch: repository.default_branch, visibility: repository.visibility }
}

