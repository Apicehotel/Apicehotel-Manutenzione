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
  const upstream = 'https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/randai-whatsapp-inbound'
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
        'x-randai-webhook-url': 'https://apicehotel.vercel.app/api/whatsapp/incoming',
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
