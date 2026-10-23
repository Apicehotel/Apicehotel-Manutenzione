function resolveUpstream() {
  const explicit = String(process.env.RANDAI_WHATSAPP_INBOUND_URL || '').trim()
  if (explicit) return explicit
  const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
  if (supabaseUrl) return `${supabaseUrl}/functions/v1/randai-whatsapp-inbound`
  // Last-resort production default when server env is incomplete.
  return 'https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/randai-whatsapp-inbound'
}

function resolvePublicWebhookUrl(req) {
  const explicit = String(process.env.WHATSAPP_PUBLIC_WEBHOOK_URL || '').trim()
  if (explicit) return explicit
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https'
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()
  if (host) return `${proto}://${host}/api/whatsapp/incoming`
  return 'https://apicehotel.vercel.app/api/whatsapp/incoming'
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'randai-whatsapp-inbound' })
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET')
    res.status(405).send('Method Not Allowed')
    return
  }

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = Buffer.concat(chunks).toString('utf8')
  const signature = req.headers['x-twilio-signature'] || ''
  const ingressSecret = process.env.WHATSAPP_INBOUND_SHARED_SECRET || ''
  const upstream = resolveUpstream()
  const webhookUrl = resolvePublicWebhookUrl(req)
  const fallbackTwiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Messaggio ricevuto. Il servizio e momentaneamente occupato: riprova tra poco.</Message></Response>'

  if (!ingressSecret) {
    console.error('whatsapp proxy is missing WHATSAPP_INBOUND_SHARED_SECRET')
    res.status(503).send('Service Unavailable')
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(upstream, {
      method: 'POST',
      headers: {
        'content-type': req.headers['content-type'] || 'application/x-www-form-urlencoded',
        'x-twilio-signature': signature,
        'x-randai-webhook-url': webhookUrl,
        'x-randai-whatsapp-shared-secret': ingressSecret,
      },
      body,
      signal: controller.signal,
    })
    const text = await response.text()
    res.status(response.status)
    res.setHeader('content-type', response.headers.get('content-type') || 'text/xml; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.send(text)
  } catch (error) {
    console.error('whatsapp proxy failure', error)
    res.status(200)
    res.setHeader('content-type', 'text/xml; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.send(fallbackTwiml)
  } finally {
    clearTimeout(timeout)
  }
}
