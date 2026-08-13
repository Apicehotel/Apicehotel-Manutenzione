export default function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ ok: false })
  const configured = Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY && process.env.GITHUB_REPO && process.env.GITHUB_BRIDGE_SECRET)
  return response.status(configured ? 200 : 503).json({ ok: configured, service: 'github-app-bridge' })
}

