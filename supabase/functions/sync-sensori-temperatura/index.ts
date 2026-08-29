const U = Deno.env.get("SUPABASE_URL")!
const S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const REGION = "eu"
const SOGLIA = 20

async function db(path: string, init: RequestInit = {}) {
  return fetch(`${U}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: S,
      Authorization: `Bearer ${S}`,
      ...(init.headers || {}),
    },
  })
}

async function secret(key: string) {
  const r = await fetch(`${U}/rest/v1/rpc/get_edge_secret`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: S, Authorization: `Bearer ${S}` },
    body: JSON.stringify({ p_key: key }),
  })
  if (!r.ok) throw new Error(`secret:${key}`)
  return await r.json()
}

async function hmac(secretValue: string, message: string) {
  const e = new TextEncoder()
  const k = await crypto.subtle.importKey("raw", e.encode(secretValue), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const s = await crypto.subtle.sign("HMAC", k, e.encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(s)))
}

function relayState(params: Record<string, unknown> | undefined): "on" | "off" | "mixed" | null {
  if (!params) return null
  const direct = params.switch
  if (direct === "on" || direct === "off") return direct

  const switches = Array.isArray(params.switches) ? params.switches : []
  const states = switches
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).switch : null))
    .filter((value): value is "on" | "off" => value === "on" || value === "off")

  if (!states.length) return null
  return states.every((state) => state === states[0]) ? states[0] : "mixed"
}

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), {
  status: s,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
})

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405)
  try {
    const expected = await secret("sensor_sync_secret")
    const provided = req.headers.get("x-sync-secret") || ""
    if (!provided || provided !== expected) return json({ ok: false, error: "unauthorized" }, 401)

    const [appId, appSecret, email, password] = await Promise.all([
      secret("ewelink_app_id"),
      secret("ewelink_app_secret"),
      secret("ewelink_email"),
      secret("ewelink_password"),
    ])

    const payload = { email, password, countryCode: "+39" }
    const data = JSON.stringify(payload)
    const sign = await hmac(appSecret, data)
    const lr = await fetch(`https://${REGION}-apia.coolkit.cc/v2/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CK-Appid": appId, Authorization: `Sign ${sign}` },
      body: data,
    })
    const lj = await lr.json()
    if (lj.error !== 0) return json({ ok: false, step: "login" }, 502)

    const dr = await fetch(`https://${REGION}-apia.coolkit.cc/v2/device/thing`, {
      headers: { Authorization: `Bearer ${lj.data.at}`, "X-CK-Appid": appId },
    })
    const dj = await dr.json()
    const rows: Array<Record<string, unknown>> = []

    for (const t of dj.data?.thingList || []) {
      const item = t.itemData
      const id = item?.deviceid
      if (!id) continue
      const params = item?.params || {}
      const online = !!item?.online
      const raw = params.currentTemperature
      const temp = raw == null ? null : parseFloat(String(raw))
      rows.push({
        device_id: id,
        nome: item?.name,
        temperatura: Number.isFinite(temp) ? temp : null,
        umidita: params.currentHumidity ?? null,
        switch_state: relayState(params),
        online,
        in_allerta: online && Number.isFinite(temp) && temp > SOGLIA,
        aggiornato_il: new Date().toISOString(),
      })
    }

    if (rows.length) {
      const r = await db("sensori_temperatura?on_conflict=device_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(rows),
      })
      if (!r.ok) return json({ ok: false, step: "save" }, 500)
    }

    const withSwitchState = rows.filter((row) => row.switch_state === "on" || row.switch_state === "off" || row.switch_state === "mixed").length
    return json({ ok: true, sensori: rows.length, switch_states: withSwitchState })
  } catch (e) {
    console.error("sync sensors failed", e instanceof Error ? e.message : "unknown")
    return json({ ok: false, error: "temporary_error" }, 500)
  }
})
