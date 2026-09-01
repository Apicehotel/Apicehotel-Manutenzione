import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import QRCode from "npm:qrcode@1.5.4"

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  try {
    const { text } = await req.json()
    const value = String(text || '').trim()
    if (!value || value.length > 1024) return new Response(JSON.stringify({ error: 'Codice non valido' }), { status: 400, headers: { 'content-type': 'application/json' } })
    const svg = await QRCode.toString(value, { type: 'svg', margin: 1, width: 256, errorCorrectionLevel: 'M' })
    return new Response(JSON.stringify({ svg }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || 'QR non generato' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
