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
  const upstream = 'https://ooqlfldcrnkudhgjnied.supabase.co/functions/v1/randai-whatsapp-inbound'

  try {
    const response = await fetch(upstream, {
      method: 'POST',
      headers: {
        'content-type': req.headers['content-type'] || 'application/x-www-form-urlencoded',
        'x-twilio-signature': signature,
        'x-randai-webhook-url': 'https://apicehotel.vercel.app/api/whatsapp/incoming',
      },
      body,
    })
    const text = await response.text()
    res.status(response.status)
    res.setHeader('content-type', response.headers.get('content-type') || 'text/xml; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.send(text)
  } catch (error) {
    console.error('whatsapp proxy failure', error)
    res.status(502).send('Bad Gateway')
  }
}
