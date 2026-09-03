-- WP1 — WhatsApp Channel Foundation
-- Atomic, hotel-scoped inbound throttling. Service-role Edge Functions are the only intended caller.
-- `whatsapp_channel_settings.inbound_number` is already UNIQUE in the canonical schema;
-- WP1 deliberately reuses that constraint instead of creating a duplicate index.

create table if not exists public.whatsapp_inbound_rate_limits (
  hotel_id text not null,
  sender_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (hotel_id, sender_key)
);

alter table public.whatsapp_inbound_rate_limits enable row level security;
-- Deliberately no client policies: service_role bypasses RLS.

create or replace function public.consume_whatsapp_inbound_quota(
  p_hotel_id text,
  p_sender_key text,
  p_limit integer default 12,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  if nullif(btrim(p_hotel_id), '') is null or nullif(btrim(p_sender_key), '') is null then
    raise exception 'hotel_id and sender_key are required';
  end if;
  if p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid quota parameters';
  end if;

  insert into public.whatsapp_inbound_rate_limits as q (hotel_id, sender_key, window_start, request_count, updated_at)
  values (p_hotel_id, p_sender_key, v_now, 1, v_now)
  on conflict (hotel_id, sender_key) do update
  set window_start = case
        when q.window_start <= v_now - make_interval(secs => p_window_seconds) then v_now
        else q.window_start
      end,
      request_count = case
        when q.window_start <= v_now - make_interval(secs => p_window_seconds) then 1
        else q.request_count + 1
      end,
      updated_at = v_now
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$function$;

revoke all on function public.consume_whatsapp_inbound_quota(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_whatsapp_inbound_quota(text, text, integer, integer) to service_role;

create index if not exists whatsapp_inbound_rate_limits_updated_idx
  on public.whatsapp_inbound_rate_limits (updated_at);
