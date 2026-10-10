import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import QRCode from "npm:qrcode@1.5.4"

const url = Deno.env.get("SUPABASE_URL")!
const anon = Deno.env.get("SUPABASE_ANON_KEY")!
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json", "cache-control": "no-store" },
  })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
  try {
    const client = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("authorization") || "" } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await client.auth.getUser()
    if (userError || !userData.user) return json({ error: "unauthorized" }, 401)

    const { text } = await req.json().catch(() => ({}))
    const value = String(text || "").trim()
    if (!value || value.length > 1024) return json({ error: "Codice non valido" }, 400)
    const svg = await QRCode.toString(value, { type: "svg", margin: 1, width: 256, errorCorrectionLevel: "M" })
    return json({ svg })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "QR non generato" }, 500)
  }
})
