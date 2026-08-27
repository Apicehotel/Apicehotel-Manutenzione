import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-randapp-request", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control":"no-store" } });
const URGENT_ROLES = new Set(["admin","manutentore","Direzione","Direttore Centro Congressi","Reception","Portiere Notturno"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok:false, error:"method_not_allowed" },405);
  try {
    const client = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession:false, autoRefreshToken:false } });
    const { data:userData, error:userError } = await client.auth.getUser();
    if (userError || !userData.user) return json({ ok:false,error:"unauthorized" },401);
    const body = await req.json().catch(()=>({}));
    const hotelId = String(body?.hotel_id || "").trim();
    if (!hotelId) return json({ ok:false,error:"hotel_id_required" },400);
    const { data:membership } = await admin.from("hotel_memberships").select("role,active").eq("auth_user_id",userData.user.id).eq("hotel_id",hotelId).maybeSingle();
    if (!membership?.active) return json({ ok:false,error:"forbidden" },403);

    const housekeeping = membership.role === "Capo Governante";
    if (!housekeeping && !URGENT_ROLES.has(membership.role)) {
      const { data:setting } = await admin.from("integration_settings").select("enabled,config").eq("key","ntfy_alerts").maybeSingle();
      const reminderTopic = String(setting?.config?.role_topics?.[hotelId]?.[membership.role] || "");
      if (!setting?.enabled || !reminderTopic) return json({ ok:true,enabled:false,channel:"reminders" });
      return json({ok:true,enabled:true,server:String(setting.config?.server||"https://ntfy.sh"),topic:reminderTopic,channel:"reminders",role:membership.role,apps:{ios:"https://apps.apple.com/it/app/ntfy/id1625396347",android:"https://play.google.com/store/apps/details?id=io.heckel.ntfy",web:"https://ntfy.sh/app"}});
    }

    const key = housekeeping ? "ntfy_housekeeping" : "ntfy_alerts";
    const { data:setting } = await admin.from("integration_settings").select("enabled,config").eq("key",key).maybeSingle();
    if (!setting?.enabled) return json({ ok:true,enabled:false,channel:housekeeping?"housekeeping":"urgent" });
    const server = String(setting.config?.server || "https://ntfy.sh");
    const topic = String(setting.config?.topics?.[hotelId] || "");
    const reminderTopic = String(setting.config?.role_topics?.[hotelId]?.[membership.role] || "");
    if (!topic && !reminderTopic) return json({ ok:false,error:"topic_not_configured" },404);
    return json({
      ok:true,
      enabled:true,
      server,
      topic,
      reminder_topic: reminderTopic || null,
      role: membership.role,
      channel:housekeeping?"housekeeping":"urgent",
      apps:{ios:"https://apps.apple.com/it/app/ntfy/id1625396347",android:"https://play.google.com/store/apps/details?id=io.heckel.ntfy",web:"https://ntfy.sh/app"}
    });
  } catch (error) {
    console.error("ntfy-config", error instanceof Error ? error.message : "unknown");
    return json({ ok:false,error:"config_failed" },500);
  }
});
