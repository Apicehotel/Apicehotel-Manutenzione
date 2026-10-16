import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";
import bcrypt from "npm:bcryptjs@2.4.3";

const DB_URL = Deno.env.get("SUPABASE_DB_URL")!;
const sql = postgres(DB_URL, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const cleanText = (v: unknown, max = 1000) => String(v ?? "").trim().slice(0, max);

async function actor(body: any) {
  const username = cleanText(body?.username, 120).toLowerCase();
  const pin = cleanText(body?.pin, 20);
  if (!username || !/^\d{6,12}$/.test(pin)) return null;
  const rows = await sql`
    select username,pin_hash,role,active
    from eye_supremo.eye_central_users
    where username=${username}
    limit 1
  `;
  const row = rows[0];
  if (!row?.active || !(await bcrypt.compare(pin, row.pin_hash))) return null;
  return row;
}

async function invoicePage(body: any) {
  const limit = Math.max(1, Math.min(Number(body.limit ?? body.p_limit) || 50, 500));
  const offset = Math.max(0, Number(body.offset ?? body.p_offset) || 0);
  const since = body.since ?? body.p_since ?? null;
  const items = since
    ? await sql`
        select i.id,i.source_hash,i.source_filename,i.invoice_number,i.invoice_date,
               i.taxable,i.vat,i.total,i.currency,i.destination_hotel,
               s.ragione_sociale as supplier_name,i.updated_at
        from eye_supremo.eye_central_invoices i
        join eye_supremo.eye_central_suppliers s on s.id=i.supplier_id
        where i.updated_at > ${String(since)}::timestamptz
        order by i.invoice_date desc,i.id
        offset ${offset} limit ${limit}
      `
    : await sql`
        select i.id,i.source_hash,i.source_filename,i.invoice_number,i.invoice_date,
               i.taxable,i.vat,i.total,i.currency,i.destination_hotel,
               s.ragione_sociale as supplier_name,i.updated_at
        from eye_supremo.eye_central_invoices i
        join eye_supremo.eye_central_suppliers s on s.id=i.supplier_id
        order by i.invoice_date desc,i.id
        offset ${offset} limit ${limit}
      `;
  const total = (await sql`select count(*)::int as n from eye_supremo.eye_central_invoices`)[0]?.n ?? 0;
  return { items, offset, limit, total };
}

async function reviewPage(body: any) {
  const limit = Math.max(1, Math.min(Number(body.limit ?? body.p_limit) || 200, 500));
  const offset = Math.max(0, Number(body.offset ?? body.p_offset) || 0);
  const since = body.since ?? body.p_since ?? null;
  const items = since
    ? await sql`
        select sync_uuid,hotel_code,review_date,source,author,rating,room_code,text,updated_at
        from eye_supremo.eye_central_reviews
        where updated_at > ${String(since)}::timestamptz
        order by review_date desc,sync_uuid
        offset ${offset} limit ${limit}
      `
    : await sql`
        select sync_uuid,hotel_code,review_date,source,author,rating,room_code,text,updated_at
        from eye_supremo.eye_central_reviews
        order by review_date desc,sync_uuid
        offset ${offset} limit ${limit}
      `;
  const total = (await sql`select count(*)::int as n from eye_supremo.eye_central_reviews`)[0]?.n ?? 0;
  return { items, offset, limit, total };
}

async function search(body: any) {
  const q = cleanText(body.query, 160);
  const limit = Math.max(1, Math.min(Number(body.limit) || 50, 500));
  const items = q
    ? await sql`
        select *
        from eye_supremo.eye_central_invoice_search
        where supplier_name ilike ${"%" + q + "%"}
           or original_description ilike ${"%" + q + "%"}
           or normalized_description ilike ${"%" + q + "%"}
           or invoice_number ilike ${"%" + q + "%"}
        order by invoice_date desc
        limit ${limit}
      `
    : await sql`
        select * from eye_supremo.eye_central_invoice_search
        order by invoice_date desc limit ${limit}
      `;
  return { items, count: items.length };
}

async function upsertInvoice(body: any) {
  const p = body.invoice || {}, s = body.supplier || {};
  return await sql.begin(async (tx) => {
    const supplierRows = await tx`
      insert into eye_supremo.eye_central_suppliers(ragione_sociale,partita_iva,codice_fiscale)
      values(
        ${cleanText(s.ragione_sociale,240) || "Fornitore non specificato"},
        ${cleanText(s.partita_iva,32) || null},
        ${cleanText(s.codice_fiscale,32) || null}
      )
      on conflict(partita_iva) do update
      set ragione_sociale=excluded.ragione_sociale,
          codice_fiscale=coalesce(excluded.codice_fiscale,eye_supremo.eye_central_suppliers.codice_fiscale)
      returning id
    `;
    const supplierId = supplierRows[0].id;
    const invoiceRows = await tx`
      insert into eye_supremo.eye_central_invoices(
        source_hash,source_filename,supplier_id,invoice_number,invoice_date,
        taxable,vat,total,currency,destination_hotel,extracted_text
      ) values(
        ${cleanText(body.source_hash,128)},
        ${cleanText(body.source_filename,260) || "documento"},
        ${supplierId},
        ${cleanText(p.numero,120) || "N/D"},
        ${p.data || null},
        ${Number(p.imponibile || 0)},${Number(p.iva || 0)},${Number(p.totale || 0)},
        ${cleanText(p.valuta,8) || "EUR"},${body.destination_hotel || null},${body.extracted_text || null}
      )
      on conflict(source_hash) do update set
        source_filename=excluded.source_filename,supplier_id=excluded.supplier_id,
        invoice_number=excluded.invoice_number,invoice_date=excluded.invoice_date,
        taxable=excluded.taxable,vat=excluded.vat,total=excluded.total,currency=excluded.currency,
        destination_hotel=excluded.destination_hotel,extracted_text=excluded.extracted_text,updated_at=now()
      returning id
    `;
    const invoiceId = invoiceRows[0].id;
    await tx`delete from eye_supremo.eye_central_invoice_rows where invoice_id=${invoiceId}`;
    for (const r of Array.isArray(body.rows) ? body.rows : []) {
      const status = ["product","accounting_excluded","review"].includes(r.analysis_status) ? r.analysis_status : "product";
      await tx`
        insert into eye_supremo.eye_central_invoice_rows(
          invoice_id,original_description,normalized_description,quantity,original_unit,
          normalized_unit,unit_price,line_total,vat_rate,normalized_price,confidence,
          analysis_status,exclusion_reason
        ) values(
          ${invoiceId},
          ${cleanText(r.descrizione_originale,500) || "Riga"},
          ${cleanText(r.descrizione_normalizzata || r.descrizione_originale,500) || "riga"},
          ${Number(r.quantita || 1)},${cleanText(r.unita_originale,30) || null},
          ${cleanText(r.unita_normalizzata,30) || null},${Number(r.prezzo_unitario || 0)},
          ${Number(r.totale_riga || 0)},${r.aliquota_iva == null ? null : Number(r.aliquota_iva)},
          ${r.prezzo_normalizzato == null ? null : Number(r.prezzo_normalizzato)},
          ${Number(r.confidence ?? 1)},${status},${cleanText(r.motivo_esclusione,240) || null}
        )
      `;
    }
    return { id: invoiceId };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);
  try {
    const body = await req.json();
    const a = await actor(body);
    if (!a) return json({ error: "Credenziali centrali non valide" }, 401);
    const action = String(body.action || "");
    if (action === "invoice_page") return json({ ok: true, ...(await invoicePage(body)) });
    if (action === "review_page") return json({ ok: true, ...(await reviewPage(body)) });
    if (action === "search_invoices") return json({ ok: true, ...(await search(body)) });
    if (action === "upsert_invoice" && ["developer","supremo"].includes(a.role)) return json({ ok: true, ...(await upsertInvoice(body)) });
    if (action === "upsert_invoices" && ["developer","supremo"].includes(a.role)) {
      const invoices = Array.isArray(body.invoices) ? body.invoices.slice(0,500) : [];
      let imported = 0; const errors:any[] = [];
      for (const item of invoices) {
        try { await upsertInvoice(item); imported++; }
        catch (e) { errors.push({ source_filename:item?.source_filename || "documento", error:e instanceof Error ? e.message : "Errore" }); }
      }
      return json({ ok:true, imported, errors });
    }
    return json({ error: "Azione non consentita" }, 403);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Errore remoto" }, 500);
  }
});
