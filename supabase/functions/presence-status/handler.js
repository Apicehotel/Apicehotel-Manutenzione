const MAX_MS = (7 * 60 + 20) * 60 * 1000;
const ELIGIBLE = new Set(['manutentore', 'Portiere Notturno', 'admin']);
const HOTELS = new Set(['hotelgio', 'chocohotel', 'brigantino']);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export async function handlePresence(req, { sql, authenticate, now = () => Date.now(), log = console }) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'Metodo non consentito' }, 405);
  const authorization = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(authorization)) return json({ ok: false, error: 'Non autenticato' }, 401);
  try {
    const uid = await authenticate(authorization);
    if (!uid) return json({ ok: false, error: 'Non autenticato' }, 401);
    let body;
    try { body = await req.json(); } catch { return json({ ok: false, error: 'Richiesta non valida' }, 400); }
    const action = body?.action || 'status';
    if (!['status', 'set_presence'].includes(action)) return json({ ok: false, error: 'Azione non valida' }, 400);
    const writing = action === 'set_presence';
    if (writing && typeof body.present !== 'boolean') return json({ ok: false, error: 'Presenza non valida' }, 400);
    const hotelId = typeof body?.hotel_id === 'string' ? body.hotel_id : '';
    if (writing && body.present && !HOTELS.has(hotelId)) return json({ ok: false, error: 'Struttura non valida' }, 400);

    return await sql.begin(async tx => {
      // Lock the personal row so expiry and concurrent presence updates serialize.
      const [row] = await tx`
        select u.id,u.nome,u.ruolo,u.in_struttura,u.in_struttura_dal,u.in_struttura_hotel_id
        from public.profiles p join public.utenti u on u.id=p.legacy_user_id
        where p.auth_user_id=${uid}::uuid and p.active=true and u.active=true
        for update of u
      `;
      if (!row) return json({ ok: false, error: 'Utente non disponibile' }, 403);
      const eligible = ELIGIBLE.has(row.ruolo);
      let present = Boolean(row.in_struttura);
      let since = row.in_struttura_dal ? new Date(row.in_struttura_dal).getTime() : NaN;
      let presenceHotelId = row.in_struttura_hotel_id;
      const timestamp = now();
      if (writing) {
        if (!eligible) return json({ ok: false, error: 'Ruolo non abilitato alla presenza' }, 403);
        if (body.present) {
          const [member] = await tx`
            select role from public.hotel_memberships
            where auth_user_id=${uid}::uuid and hotel_id=${hotelId} and active=true
            for share
          `;
          if (!member || !ELIGIBLE.has(member.role)) return json({ ok: false, error: 'Non abilitato per questa struttura' }, 403);
        }
        present = body.present;
        since = present ? timestamp : NaN;
        presenceHotelId = present ? hotelId : null;
        await tx`
          update public.utenti set in_struttura=${present},
            in_struttura_dal=${present ? new Date(since).toISOString() : null}::timestamptz,
            in_struttura_via=${present ? 'app' : null},in_struttura_hotel_id=${presenceHotelId}
          where id=${row.id}::uuid
        `;
      } else if (present && (!Number.isFinite(since) || !presenceHotelId || timestamp - since >= MAX_MS)) {
        await tx`
          update public.utenti set in_struttura=false,in_struttura_dal=null,
            in_struttura_via=null,in_struttura_hotel_id=null where id=${row.id}::uuid
        `;
        present = false;
        presenceHotelId = null;
      }
      const sinceIso = present ? new Date(since).toISOString() : null;
      return json({
        ok: true, eligible, role: row.ruolo, name: row.nome,
        present, hotel_id: present ? presenceHotelId : null, since: sinceIso,
        expires_at: present ? new Date(since + MAX_MS).toISOString() : null,
        ...(writing ? { in_struttura: present, in_struttura_hotel_id: present ? presenceHotelId : null, in_struttura_dal: sinceIso } : {}),
      });
    });
  } catch {
    // Never log SQL parameters, user tokens, credentials or operational names.
    log.error('presence-status: dependency failure');
    return json({ ok: false, error: 'Servizio presenza temporaneamente non disponibile. Riprova.' }, 503);
  }
}
