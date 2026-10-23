import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import QRCode from "npm:qrcode@1.5.4"

const url = Deno.env.get("SUPABASE_URL")!
const anon = Deno.env.get("SUPABASE_ANON_KEY")!
const KNOWN_HOTELS = new Set(["hotelgio", "chocohotel", "brigantino"])
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

    const body = await req.json().catch(() => ({}))
    const hotelId = String(body?.hotel_id || "").trim()
    const value = String(body?.text || "").trim()
    if (!KNOWN_HOTELS.has(hotelId)) return json({ error: "hotel_id non valido" }, 400)
    if (!value || value.length > 1024) return json({ error: "Codice non valido" }, 400)

    const { data: membership, error: membershipError } = await client
      .from("hotel_memberships")
      .select("active")
      .eq("auth_user_id", userData.user.id)
      .eq("hotel_id", hotelId)
      .eq("active", true)
      .maybeSingle()
    if (membershipError || !membership) return json({ error: "forbidden" }, 403)

    // Deep links must stay hotel-scoped when present (item:<hotelId>:…).
    const deep = value.match(/^item:([^:]+):(.+)$/i)
    if (deep && deep[1] !== hotelId) return json({ error: "hotel_mismatch" }, 403)

    const svg = await QRCode.toString(value, { type: "svg", margin: 1, width: 256, errorCorrectionLevel: "M" })
    return json({ svg })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "QR non generato" }, 500)
  }
})
