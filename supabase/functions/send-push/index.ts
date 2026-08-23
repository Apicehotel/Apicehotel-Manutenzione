import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const URGENT_SENDER_ROLES = new Set(["admin", "Direzione", "Direttore Centro Congressi"]);
const RECIPIENT_ROLES = new Set(["manutentore"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  try {
    const { data: flag } = await admin.from("integration_settings").select("enabled").eq("key", "push_notifications").maybeSingle();
    if (!flag?.enabled) return json({ ok: true, enabled: false, status: "disabled", sent: 0 });

    const client = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return json({ ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const hotel = String(body?.hotel_id || "").trim();
    const eventType = String(body?.event_type || "urgent").trim();
    if (!hotel) return json({ ok: false, error: "hotel_id_required" }, 400);
    if (!new Set(["urgent", "issue_created"]).has(eventType)) return json({ ok: false, error: "unsupported_event_type" }, 400);

    const { data: callerMembership } = await admin.from("hotel_memberships").select("role,active").eq("auth_user_id", userData.user.id).eq("hotel_id", hotel).maybeSingle();
    if (!callerMembership?.active) return json({ ok: false, error: "forbidden" }, 403);

    if (eventType === "urgent") {
      const { data: callerProfile } = await admin.from("profiles").select("department").eq("auth_user_id", userData.user.id).maybeSingle();
      const authorized = URGENT_SENDER_ROLES.has(callerMembership.role) || callerProfile?.department === "Reception";
      if (!authorized) return json({ ok: false, error: "forbidden" }, 403);
    }

    const urgent = eventType === "urgent";
    const issueId = String(body?.issue_id || "").trim();
    const room = String(body?.room || "").trim();
    const category = String(body?.category || "").trim();
    const defaultTitle = urgent ? "Avviso urgente" : room ? `Nuova segnalazione · ${room}` : "Nuova segnalazione";
    const defaultBody = urgent ? "Aggiornamento urgente" : [category, body?.note].filter(Boolean).join(" · ") || "Nuova segnalazione di manutenzione";
    const title = String(body?.title || defaultTitle).slice(0, 120);
    const messageBody = String(body?.body || body?.note || defaultBody).slice(0, 500);
    const tag = urgent ? "avviso-urgente" : `segnalazione-${issueId || Date.now()}`;

    const { data: outboxRow } = await admin.from("notification_outbox").insert({
      channel: "push",
      hotel_id: hotel,
      subject: title,
      body: messageBody,
      status: "pending",
      metadata: { requested_by: userData.user.id, event_type: eventType, issue_id: issueId || null },
    }).select("id").single();

    const { data: recipients } = await admin.from("hotel_memberships").select("auth_user_id").eq("hotel_id", hotel).eq("active", true).in("role", [...RECIPIENT_ROLES]);
    const recipientIds = (recipients || []).map((row: any) => row.auth_user_id).filter((id: string) => id && (urgent || id !== userData.user.id));
    if (!recipientIds.length) {
      if (outboxRow) await admin.from("notification_outbox").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", outboxRow.id);
      return json({ ok: true, enabled: true, status: "sent", sent: 0, note: "nessun destinatario push" });
    }

    const { data: subs } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth,utente").eq("hotel_id", hotel).in("utente", recipientIds);
    if (!subs || !subs.length) {
      if (outboxRow) await admin.from("notification_outbox").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", outboxRow.id);
      return json({ ok: true, enabled: true, status: "sent", sent: 0, note: "nessun abbonamento push registrato" });
    }

    const { data: secrets } = await admin.from("edge_function_secrets").select("key,value").in("key", ["vapid_public", "vapid_private", "vapid_subject"]);
    const secretMap = new Map((secrets || []).map((row: any) => [row.key, row.value]));
    const vapidPublic = secretMap.get("vapid_public");
    const vapidPrivate = secretMap.get("vapid_private");
    const vapidSubject = secretMap.get("vapid_subject") || "mailto:appmanutenzioneapice@gmail.com";
    if (!vapidPublic || !vapidPrivate) {
      if (outboxRow) await admin.from("notification_outbox").update({ status: "failed", error: "vapid_keys_missing" }).eq("id", outboxRow.id);
      return json({ ok: false, error: "vapid_keys_missing" }, 500);
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const payload = JSON.stringify({ title, body: messageBody, tag, url: "/", urgent, eventType, issueId: issueId || null });
    let sent = 0;
    const expiredIds: string[] = [];
    await Promise.all(subs.map(async (sub: any) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent += 1;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) expiredIds.push(sub.id);
      }
    }));
    if (expiredIds.length) await admin.from("push_subscriptions").delete().in("id", expiredIds);

    if (outboxRow) await admin.from("notification_outbox").update({ status: sent > 0 ? "sent" : "failed", sent_at: new Date().toISOString(), error: sent > 0 ? null : "no_delivery" }).eq("id", outboxRow.id);
    return json({ ok: true, enabled: true, status: "sent", sent, targeted: subs.length, event_type: eventType });
  } catch (error) {
    console.error("send-push", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "send_failed" }, 500);
  }
});
