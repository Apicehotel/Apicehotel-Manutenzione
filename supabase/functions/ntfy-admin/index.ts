import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-randapp-request",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const ALL_HOTELS = ["hotelgio", "chocohotel", "brigantino"] as const;
const HOTEL_NAMES: Record<string, string> = {
  hotelgio: "Hotel Giò",
  chocohotel: "Chocohotel",
  brigantino: "Hotel Il Brigantino",
};
const ROLES = [
  "admin", "Supremo", "Direzione", "Direttore Centro Congressi", "Portiere Notturno",
  "manutentore", "Tecnico esterno", "Governante", "Capo Governante", "Reception",
  "Isola dei Golosi", "Ristorante Wine/Jazz", "Colazione Jazz", "Responsabile",
];

function randomTopic(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${token}`;
}

async function caller(req: Request) {
  const token = req.headers.get("authorization") || "";
  const client = createClient(URL, ANON, {
    global: { headers: { Authorization: token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  return data.user.id;
}

async function requireAdmin(req: Request, hotelId: string) {
  const uid = await caller(req);
  const { data, error } = await admin
    .from("hotel_memberships")
    .select("hotel_id,role,active,can_access_admin")
    .eq("auth_user_id", uid)
    .eq("hotel_id", hotelId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.active || !(data.role === "admin" || data.can_access_admin)) throw new Error("FORBIDDEN");
  return uid;
}

function serverHost(server: string) {
  try {
    return new URL(server).host;
  } catch {
    return "ntfy.sh";
  }
}

function hotelStatus(config: Record<string, unknown> | null, hotelId: string) {
  const topics = (config?.topics && typeof config.topics === "object" ? config.topics : {}) as Record<string, string>;
  const roleTopics = (config?.role_topics && typeof config.role_topics === "object" ? config.role_topics : {}) as Record<string, Record<string, string>>;
  const hotelRoles = roleTopics[hotelId] && typeof roleTopics[hotelId] === "object" ? roleTopics[hotelId] : {};
  const roleConfigured = ROLES.filter((role) => Boolean(String(hotelRoles[role] || "").trim())).length;
  return {
    hotel_id: hotelId,
    label: HOTEL_NAMES[hotelId] || hotelId,
    urgent_configured: Boolean(String(topics[hotelId] || "").trim()),
    role_topics_configured: roleConfigured,
    role_topics_expected: ROLES.length,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status").trim();
    const hotelId = String(body?.hotel_id || "").trim();
    if (!ALL_HOTELS.includes(hotelId as typeof ALL_HOTELS[number])) {
      return json({ ok: false, error: "hotel_id_required" }, 400);
    }
    await requireAdmin(req, hotelId);

    if (action === "status") {
      const [{ data: alerts }, { data: housekeeping }, { data: outbox }] = await Promise.all([
        admin.from("integration_settings").select("enabled,config,updated_at").eq("key", "ntfy_alerts").maybeSingle(),
        admin.from("integration_settings").select("enabled,config").eq("key", "ntfy_housekeeping").maybeSingle(),
        admin
          .from("notification_outbox")
          .select("id,channel,subject,status,created_at,sent_at,metadata")
          .eq("hotel_id", hotelId)
          .eq("channel", "ntfy")
          .order("created_at", { ascending: false })
          .limit(12),
      ]);
      const config = (alerts?.config || {}) as Record<string, unknown>;
      const hkTopics = (housekeeping?.config?.topics && typeof housekeeping.config.topics === "object"
        ? housekeeping.config.topics
        : {}) as Record<string, string>;
      const hotels = ALL_HOTELS.map((id) => hotelStatus(config, id));
      return json({
        ok: true,
        hotel_id: hotelId,
        enabled: Boolean(alerts?.enabled),
        server: String(config.server || "https://ntfy.sh"),
        server_host: serverHost(String(config.server || "https://ntfy.sh")),
        updated_at: alerts?.updated_at || null,
        hotels,
        current: hotels.find((item) => item.hotel_id === hotelId) || null,
        housekeeping: {
          enabled: Boolean(housekeeping?.enabled),
          configured: Boolean(String(hkTopics[hotelId] || "").trim()),
        },
        recent: outbox || [],
      });
    }

    if (action === "set_enabled") {
      const enabled = body?.enabled === true;
      const { data: existing } = await admin.from("integration_settings").select("config").eq("key", "ntfy_alerts").maybeSingle();
      if (!existing) {
        return json({ ok: false, error: "ntfy_alerts_missing" }, 404);
      }
      const { error } = await admin
        .from("integration_settings")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("key", "ntfy_alerts");
      if (error) throw error;
      return json({ ok: true, enabled });
    }

    if (action === "ensure_topics") {
      const { data: existing, error: readError } = await admin
        .from("integration_settings")
        .select("enabled,config")
        .eq("key", "ntfy_alerts")
        .maybeSingle();
      if (readError) throw readError;

      const config = (existing?.config && typeof existing.config === "object" ? structuredClone(existing.config) : {}) as Record<string, any>;
      config.server = String(config.server || "https://ntfy.sh");
      config.topics = config.topics && typeof config.topics === "object" ? config.topics : {};
      config.role_topics = config.role_topics && typeof config.role_topics === "object" ? config.role_topics : {};

      let createdUrgent = 0;
      let createdRoles = 0;
      for (const id of ALL_HOTELS) {
        if (!String(config.topics[id] || "").trim()) {
          config.topics[id] = randomTopic(`randapp-urgent-${id}`);
          createdUrgent += 1;
        }
        config.role_topics[id] = config.role_topics[id] && typeof config.role_topics[id] === "object"
          ? config.role_topics[id]
          : {};
        for (const role of ROLES) {
          if (!String(config.role_topics[id][role] || "").trim()) {
            config.role_topics[id][role] = randomTopic(`randapp-rem-${id}`);
            createdRoles += 1;
          }
        }
      }

      const payload = {
        enabled: existing ? Boolean(existing.enabled) : true,
        config,
        updated_at: new Date().toISOString(),
      };
      const { error } = existing
        ? await admin.from("integration_settings").update(payload).eq("key", "ntfy_alerts")
        : await admin.from("integration_settings").insert({ key: "ntfy_alerts", ...payload });
      if (error) throw error;

      return json({
        ok: true,
        created_urgent: createdUrgent,
        created_role_topics: createdRoles,
        hotels: ALL_HOTELS.map((id) => hotelStatus(config, id)),
      });
    }

    if (action === "test_urgent") {
      const { data: setting } = await admin
        .from("integration_settings")
        .select("enabled,config")
        .eq("key", "ntfy_alerts")
        .maybeSingle();
      if (!setting?.enabled) return json({ ok: false, error: "ntfy_disabled" }, 409);
      const topic = String(setting.config?.topics?.[hotelId] || "").trim();
      if (!topic) return json({ ok: false, error: "topic_not_configured" }, 404);
      const server = String(setting.config?.server || "https://ntfy.sh").replace(/\/$/, "");
      const title = `TEST Admin · ${HOTEL_NAMES[hotelId] || hotelId}`;
      const message = "Canale ntfy Avvisi Urgenti verificato dall'amministrazione RandApp.";
      const res = await fetch(server, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          title,
          message,
          priority: 3,
          tags: ["white_check_mark", "bell"],
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return json({ ok: false, error: "delivery_failed", status: res.status, detail: text.slice(0, 160) }, 502);
      }
      await admin.from("notification_outbox").insert({
        channel: "ntfy",
        hotel_id: hotelId,
        subject: title,
        body: message,
        status: "sent",
        sent_at: new Date().toISOString(),
        metadata: { event_type: "admin_test", channel: "urgent" },
      });
      return json({ ok: true, status: "sent", channel: "urgent", priority: 3 });
    }

    return json({ ok: false, error: "invalid_action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "UNAUTHORIZED") return json({ ok: false, error: "unauthorized" }, 401);
    if (message === "FORBIDDEN") return json({ ok: false, error: "forbidden" }, 403);
    console.error("ntfy-admin", message);
    return json({ ok: false, error: "admin_failed" }, 500);
  }
});
