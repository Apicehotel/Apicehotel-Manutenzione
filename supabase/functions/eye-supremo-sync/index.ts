import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";

const DB_URL = Deno.env.get("SUPABASE_DB_URL")!;
const API_URL = Deno.env.get("SUPABASE_URL")!;
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sql = postgres(DB_URL, { prepare:false, max:3, idle_timeout:20, connect_timeout:10 });
const json = (data: unknown, status=200) => new Response(JSON.stringify(data), {status,headers:{"content-type":"application/json; charset=utf-8"}});

async function authUser(authHeader:string) {
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const res = await fetch(`${API_URL}/auth/v1/user`, { headers:{apikey:PUBLIC_KEY,Authorization:authHeader} });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? user : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({error:"POST required"},405);
  const user = await authUser(req.headers.get("authorization") || "");
  if (!user) return json({error:"unauthorized"},401);

  const memberships = await sql`
    select role_name,hotel_codes,can_read_all,active
    from eye_supremo.eye_sync_memberships
    where user_id=${user.id}::uuid
    limit 1
  `;
  const membership = memberships[0];
  if (!membership?.active) return json({error:"Eye Supremo membership required"},403);

  const body = await req.json().catch(()=>({}));
  const action = String(body.action || "push");
  const allAccess = Boolean(membership.can_read_all) || ["developer","supremo"].includes(membership.role_name);
  const allowedHotels:string[] = Array.isArray(membership.hotel_codes) ? membership.hotel_codes : [];

  if (action === "push") {
    const objects = Array.isArray(body.objects) ? body.objects.slice(0,500) : [];
    let count = 0;
    for (const item of objects) {
      const hotel = String(item.hotel_code || "");
      if (!["gio","choco","brigantino"].includes(hotel)) return json({error:`invalid hotel ${hotel}`},422);
      if (!allAccess && !allowedHotels.includes(hotel)) return json({error:`hotel not allowed: ${hotel}`},403);
      if (!item.entity_uuid || !item.entity_type) return json({error:"entity_uuid and entity_type required"},422);
      const payload = JSON.stringify(item.payload || {});
      await sql`
        insert into eye_supremo.eye_sync_objects(
          hotel_code,entity_type,entity_uuid,payload,source_device,updated_by,updated_at
        ) values(
          ${hotel},${String(item.entity_type).slice(0,80)},${item.entity_uuid}::uuid,
          ${payload}::jsonb,${item.source_device ? String(item.source_device).slice(0,160) : null},
          ${user.id}::uuid,now()
        )
        on conflict(entity_type,entity_uuid) do update set
          hotel_code=excluded.hotel_code,payload=excluded.payload,source_device=excluded.source_device,
          updated_by=excluded.updated_by,updated_at=excluded.updated_at
      `;
      count++;
    }
    return json({ok:true,count});
  }

  if (action === "pull") {
    const requested = Array.isArray(body.hotel_codes) ? body.hotel_codes.map(String) : [];
    const hotels = allAccess
      ? (requested.length ? requested : ["gio","choco","brigantino"])
      : allowedHotels.filter((h:string)=>!requested.length || requested.includes(h));
    if (!hotels.length) return json({ok:true,objects:[]});
    const since = body.since ? String(body.since) : null;
    const objects = since
      ? await sql`
          select hotel_code,entity_type,entity_uuid,payload,source_device,updated_at
          from eye_supremo.eye_sync_objects
          where hotel_code = any(${hotels}::text[]) and updated_at > ${since}::timestamptz
          order by updated_at asc limit 1000
        `
      : await sql`
          select hotel_code,entity_type,entity_uuid,payload,source_device,updated_at
          from eye_supremo.eye_sync_objects
          where hotel_code = any(${hotels}::text[])
          order by updated_at asc limit 1000
        `;
    return json({ok:true,objects});
  }

  return json({error:"unknown action"},422);
});
