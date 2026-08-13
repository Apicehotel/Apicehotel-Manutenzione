import { isAuthorized, testRepositoryRead } from '../_lib/github-app.js'

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method !== 'GET') return response.status(405).json({ ok: false })
  if (!isAuthorized(request, process.env.GITHUB_BRIDGE_SECRET)) return response.status(401).json({ ok: false })
  try {
    const result = await testRepositoryRead()
    return response.status(200).json({ ok: true, ...result })
  } catch (error) {
    console.error('GitHub bridge request failed')
    return response.status(502).json({ ok: false, error: 'github_bridge_failed' })
  }
}

