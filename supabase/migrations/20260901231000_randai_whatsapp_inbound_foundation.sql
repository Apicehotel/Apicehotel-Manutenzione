create table if not exists public.whatsapp_channel_settings (
  hotel_id text primary key,
  inbound_number text unique,
  receive_enabled boolean not null default true,
  ingestion_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  message_sid text not null unique,
  hotel_id text not null,
  from_number text not null,
  to_number text not null,
  body text not null default '',
  num_media integer not null default 0 check (num_media >= 0),
  media_content_type text,
  media_storage_path text,
  processing_status text not null default 'received' check (processing_status in ('received','paused','needs_info','created','ignored','linked','duplicate','error')),
  issue_id uuid references public.segnalazioni(id) on delete set null,
  reply_text text,
  signature_valid boolean not null default true,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists whatsapp_inbound_messages_hotel_received_idx
  on public.whatsapp_inbound_messages (hotel_id, received_at desc);
create index if not exists whatsapp_inbound_messages_status_idx
  on public.whatsapp_inbound_messages (processing_status, received_at desc);

insert into public.whatsapp_channel_settings (hotel_id, inbound_number, receive_enabled, ingestion_enabled)
values
  ('hotelgio', '+390759978247', true, false),
  ('chocohotel', '+390759970610', true, false),
  ('brigantino', null, false, false)
on conflict (hotel_id) do update set
  inbound_number = excluded.inbound_number,
  receive_enabled = excluded.receive_enabled,
  updated_at = now();

alter table public.whatsapp_channel_settings enable row level security;
alter table public.whatsapp_inbound_messages enable row level security;

revoke all on public.whatsapp_channel_settings from anon;
revoke all on public.whatsapp_inbound_messages from anon;
revoke insert, update, delete on public.whatsapp_channel_settings from authenticated;
revoke insert, update, delete on public.whatsapp_inbound_messages from authenticated;
grant select on public.whatsapp_channel_settings to authenticated;
grant select on public.whatsapp_inbound_messages to authenticated;

drop policy if exists whatsapp_channel_settings_admin_select on public.whatsapp_channel_settings;
create policy whatsapp_channel_settings_admin_select on public.whatsapp_channel_settings
for select to authenticated using (
  exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = auth.uid()
      and hm.hotel_id = whatsapp_channel_settings.hotel_id
      and hm.active = true
      and hm.can_access_admin = true
  )
);

drop policy if exists whatsapp_inbound_messages_admin_select on public.whatsapp_inbound_messages;
create policy whatsapp_inbound_messages_admin_select on public.whatsapp_inbound_messages
for select to authenticated using (
  exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = auth.uid()
      and hm.hotel_id = whatsapp_inbound_messages.hotel_id
      and hm.active = true
      and hm.can_access_admin = true
  )
);

create or replace function public.whatsapp_set_ingestion(p_hotel_id text, p_enabled boolean)
returns public.whatsapp_channel_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.whatsapp_channel_settings;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = auth.uid()
      and hm.hotel_id = p_hotel_id
      and hm.active = true
      and hm.can_access_admin = true
  ) then
    raise exception 'not authorized';
  end if;

  update public.whatsapp_channel_settings
     set ingestion_enabled = p_enabled,
         updated_at = now()
   where hotel_id = p_hotel_id
   returning * into result;

  if result.hotel_id is null then
    raise exception 'hotel not configured';
  end if;
  return result;
end;
$$;

revoke all on function public.whatsapp_set_ingestion(text, boolean) from public, anon;
grant execute on function public.whatsapp_set_ingestion(text, boolean) to authenticated;
