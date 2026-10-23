import postgres from "npm:postgres@3.4.7"

// Connessione Postgres diretta (come pin-auth): non dipende dalla chiave JWT
// service_role su PostgREST, che dal 1 ottobre 2026 risponde 401 alle Edge Function.
const DB_URL = Deno.env.get("SUPABASE_DB_URL")!
const sql = postgres(DB_URL, { prepare: false, max: 2, connect_timeout: 5, idle_timeout: 10 })
const REGION = "eu"
const DEFAULT_RULES = { stagione: "inverno", soglia_inverno_min: 20, soglia_estate_max: 18, soglia_frigo_max: 0 } as const

async function secret(key: string): Promise<string> {
  const rows = await sql`select value from public.edge_function_secrets where key = ${key} limit 1`
  const value = rows[0]?.value
  if (!value) throw new Error(`secret:${key}`)
  return String(value)
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

type SensorRole = "motore" | "frigo" | "ambiente"
type Rules = typeof DEFAULT_RULES

function evaluateAlert(role: SensorRole, temperature: number | null, online: boolean, rules: Rules) {
  if (!online || temperature == null || !Number.isFinite(temperature)) {
    return { in_allerta: false, soglia: null, allerta_tipo: null }
  }
  if (role === "motore" && rules.stagione === "inverno") {
    return { in_allerta: temperature < rules.soglia_inverno_min, soglia: rules.soglia_inverno_min, allerta_tipo: "sotto" }
  }
  if (role === "motore" && rules.stagione === "estate") {
    return { in_allerta: temperature > rules.soglia_estate_max, soglia: rules.soglia_estate_max, allerta_tipo: "sopra" }
  }
  if (role === "frigo") {
    return { in_allerta: temperature > rules.soglia_frigo_max, soglia: rules.soglia_frigo_max, allerta_tipo: "sopra" }
  }
  return { in_allerta: false, soglia: null, allerta_tipo: null }
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

    const [settingsResponse, knownSensorsResponse] = await Promise.all([
      db("sensori_impostazioni?id=eq.1&select=stagione,soglia_inverno_min,soglia_estate_max,soglia_frigo_max"),
      db("sensori_temperatura?select=device_id,ruolo"),
    ])
    const settings = settingsResponse.ok ? (await settingsResponse.json())[0] : null
    const rules: Rules = {
      stagione: settings?.stagione === "estate" ? "estate" : DEFAULT_RULES.stagione,
      soglia_inverno_min: Number.isFinite(Number(settings?.soglia_inverno_min)) ? Number(settings.soglia_inverno_min) : DEFAULT_RULES.soglia_inverno_min,
      soglia_estate_max: Number.isFinite(Number(settings?.soglia_estate_max)) ? Number(settings.soglia_estate_max) : DEFAULT_RULES.soglia_estate_max,
      soglia_frigo_max: Number.isFinite(Number(settings?.soglia_frigo_max)) ? Number(settings.soglia_frigo_max) : DEFAULT_RULES.soglia_frigo_max,
    }
    const knownSensors: Array<{ device_id: string; ruolo: SensorRole }> = knownSensorsResponse.ok ? await knownSensorsResponse.json() : []
    const roles = new Map(knownSensors.map((sensor) => [sensor.device_id, sensor.ruolo]))

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
      const ruolo: SensorRole = roles.get(id) || "ambiente"
      const alert = evaluateAlert(ruolo, Number.isFinite(temp) ? temp : null, online, rules)
      rows.push({
        device_id: id,
        nome: item?.name,
        temperatura: Number.isFinite(temp) ? temp : null,
        umidita: params.currentHumidity == null ? null : String(params.currentHumidity),
        switch_state: relayState(params),
        online,
        ruolo,
        soglia: alert.soglia,
        allerta_tipo: alert.allerta_tipo,
        in_allerta: alert.in_allerta,
        aggiornato_il: new Date().toISOString(),
      })
    }

    if (rows.length) {
      // Aggiorna solo i campi del sensore: ordine e mostra_* (visibilita per hotel) restano invariati.
      await sql`
        insert into public.sensori_temperatura
          (device_id, nome, temperatura, umidita, switch_state, online, in_allerta, aggiornato_il)
        select device_id, nome, temperatura, umidita, switch_state, online, in_allerta, aggiornato_il
        from jsonb_to_recordset(${sql.json(rows as any)}::jsonb) as r(
          device_id text, nome text, temperatura numeric, umidita text,
          switch_state text, online boolean, in_allerta boolean, aggiornato_il timestamptz
        )
        on conflict (device_id) do update set
          nome = excluded.nome,
          temperatura = excluded.temperatura,
          umidita = excluded.umidita,
          switch_state = excluded.switch_state,
          online = excluded.online,
          in_allerta = excluded.in_allerta,
          aggiornato_il = excluded.aggiornato_il
      `
    }

    const withSwitchState = rows.filter((row) => row.switch_state === "on" || row.switch_state === "off" || row.switch_state === "mixed").length
    return json({ ok: true, sensori: rows.length, switch_states: withSwitchState, stagione: rules.stagione })
  } catch (e) {
    console.error("sync sensors failed", e instanceof Error ? e.message : "unknown")
    return json({ ok: false, error: "temporary_error" }, 500)
  }
})
