-- Opaque capability tokens for public issue links (/s/<token>).
-- Existing WhatsApp links that embed the raw issue UUID keep working but are
-- rate-limited more tightly in public-iss; new shares prefer the token.

create extension if not exists pgcrypto;

alter table public.segnalazioni
  add column if not exists public_share_token text;

create unique index if not exists segnalazioni_public_share_token_uidx
  on public.segnalazioni (public_share_token)
  where public_share_token is not null;

comment on column public.segnalazioni.public_share_token is
  'Opaque capability token for public read-only /s/<token> links. Prefer over raw issue UUID.';

create or replace function public.ensure_issue_public_share_token(p_issue_id uuid, p_hotel_id text)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  if p_hotel_id is null or btrim(p_hotel_id) = '' then
    raise exception 'hotel_id mancante';
  end if;
  if not public.has_app_permission(p_hotel_id, 'issues', 'view') then
    raise exception 'Non autorizzato';
  end if;

  select public_share_token into v_token
  from public.segnalazioni
  where id = p_issue_id
    and hotel_id = p_hotel_id
  for update;

  if not found then
    raise exception 'Segnalazione non trovata';
  end if;

  if v_token is null or length(v_token) < 32 then
    v_token := encode(gen_random_bytes(24), 'hex');
    update public.segnalazioni
    set public_share_token = v_token
    where id = p_issue_id
      and hotel_id = p_hotel_id;
  end if;

  return v_token;
end;
$$;

revoke all on function public.ensure_issue_public_share_token(uuid, text) from public, anon;
grant execute on function public.ensure_issue_public_share_token(uuid, text) to authenticated, service_role;
