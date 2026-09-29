import http from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createRandMcpServer } from '../api/mcp.js'

const port = Number(process.env.PORT || process.env.RAND_MCP_PORT || 8787)
const allowedOrigins = new Set(
  String(process.env.MCP_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
)

function readJsonBody(req) {
  if (req.method !== 'POST') return Promise.resolve(undefined)
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1_000_000) reject(new Error('request_too_large'))
    })
    req.on('end', () => {
      if (!raw) return resolve(undefined)
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('invalid_json'))
      }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'rand-mcp' }))
    return
  }

  if (req.url !== '/mcp') {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'not_found' }))
    return
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { Allow: 'GET, POST, DELETE, OPTIONS' })
    res.end()
    return
  }

  const origin = String(req.headers.origin || '').trim()
  if (origin && !allowedOrigins.has(origin)) {
    res.writeHead(403, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'origin_not_allowed' }))
    return
  }

  const authorization = String(req.headers.authorization || '')
  if (!authorization.startsWith('Bearer ') || authorization.length < 32) {
    res.writeHead(401, {
      'content-type': 'application/json',
      'www-authenticate': 'Bearer realm="RandMCP"',
    })
    res.end(JSON.stringify({ error: 'unauthorized' }))
    return
  }

  try {
    const body = await readJsonBody(req)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    const mcp = createRandMcpServer({ authorization })
    await mcp.connect(transport)
    await transport.handleRequest(req, res, body)
  } catch (error) {
    console.error('rand-mcp-standalone', error)
    if (!res.headersSent) {
      const status = error?.message === 'invalid_json' ? 400 : 500
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: status === 400 ? 'invalid_json' : 'mcp_unavailable' }))
    }
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Rand MCP listening on :${port}/mcp`)
})
