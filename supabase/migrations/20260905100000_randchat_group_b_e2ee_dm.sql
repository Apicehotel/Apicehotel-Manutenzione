-- RandChat Group B
-- Global direct messages with device-scoped end-to-end encryption, 1/7/15 day retention,
-- and explicit promotion links from chat messages to persistent maintenance issues.
--
-- Server invariant: DM plaintext is never stored. The server receives only ciphertext,
-- IVs, ephemeral public keys, per-device wrapped content keys, signatures and metadata.

create table if not exists public.chat_dm_devices (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  encryption_public_key_jwk jsonb not null,
  signing_public_key_jwk jsonb not null,
  key_version smallint not null default 1 check (key_version = 1),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (auth_user_id, device_id),
  unique (id, auth_user_id),
  constraint chat_dm_device_enc_key_shape check (
    jsonb_typeof(encryption_public_key_jwk) = 'object'
    and encryption_public_key_jwk->>'kty' = 'EC'
    and encryption_public_key_jwk->>'crv' = 'P-256'
    and char_length(coalesce(encryption_public_key_jwk->>'x','')) between 40 and 100
    and char_length(coalesce(encryption_public_key_jwk->>'y','')) between 40 and 100
  ),
  constraint chat_dm_device_sign_key_shape check (
    jsonb_typeof(signing_public_key_jwk) = 'object'
    and signing_public_key_jwk->>'kty' = 'EC'
    and signing_public_key_jwk->>'crv' = 'P-256'
    and char_length(coalesce(signing_public_key_jwk->>'x','')) between 40 and 100
    and char_length(coalesce(signing_public_key_jwk->>'y','')) between 40 and 100
  )
);

create index if not exists chat_dm_devices_user_active_idx
  on public.chat_dm_devices(auth_user_id, last_seen_at desc) where revoked_at is null;

create table if not exists public.chat_dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  retention_days smallint not null default 7 check (retention_days in (1, 7, 15)),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_low, user_high),
  constraint chat_dm_thread_distinct_users check (user_low <> user_high),
  constraint chat_dm_thread_canonical_order check (user_low::text < user_high::text)
);

create index if not exists chat_dm_threads_low_idx on public.chat_dm_threads(user_low, updated_at desc);
create index if not exists chat_dm_threads_high_idx on public.chat_dm_threads(user_high, updated_at desc);

create table if not exists public.chat_dm_messages (
  id uuid primary key,
  thread_id uuid not null references public.chat_dm_threads(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  sender_device_id uuid not null,
  cipher_version smallint not null default 1 check (cipher_version = 1),
  ciphertext text not null,
  content_iv text not null,
  ephemeral_public_key_jwk jsonb not null,
  signature text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint chat_dm_message_sender_device_fk
    foreign key (sender_device_id, sender_user_id)
    references public.chat_dm_devices(id, auth_user_id) on delete restrict,
  constraint chat_dm_message_ciphertext_length check (char_length(ciphertext) between 1 and 24000),
  constraint chat_dm_message_iv_length check (char_length(content_iv) between 8 and 128),
  constraint chat_dm_message_signature_length check (char_length(signature) between 16 and 1024),
  constraint chat_dm_message_ephemeral_key_shape check (
    jsonb_typeof(ephemeral_public_key_jwk) = 'object'
    and ephemeral_public_key_jwk->>'kty' = 'EC'
    and ephemeral_public_key_jwk->>'crv' = 'P-256'
  )
);

create index if not exists chat_dm_messages_thread_created_idx
  on public.chat_dm_messages(thread_id, created_at desc);
create index if not exists chat_dm_messages_expiry_idx
  on public.chat_dm_messages(expires_at);

create table if not exists public.chat_dm_envelopes (
  message_id uuid not null references public.chat_dm_messages(id) on delete cascade,
  device_row_id uuid not null,
  recipient_user_id uuid not null,
  wrapped_key text not null,
  wrap_iv text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, device_row_id),
  constraint chat_dm_envelope_device_fk
    foreign key (device_row_id, recipient_user_id)
    references public.chat_dm_devices(id, auth_user_id) on delete cascade,
  constraint chat_dm_envelope_wrapped_key_length check (char_length(wrapped_key) between 16 and 4096),
  constraint chat_dm_envelope_iv_length check (char_length(wrap_iv) between 8 and 128)
);

create index if not exists chat_dm_envelopes_recipient_idx
  on public.chat_dm_envelopes(recipient_user_id, message_id);

create table if not exists public.chat_issue_links (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('group', 'dm')),
  group_id uuid references public.chat_groups(id) on delete set null,
  group_message_id uuid references public.chat_messages(id) on delete set null,
  dm_thread_id uuid references public.chat_dm_threads(id) on delete set null,
  dm_message_id uuid references public.chat_dm_messages(id) on delete set null,
  issue_id uuid not null references public.segnalazioni(id) on delete cascade,
  hotel_id text not null references public.hotels(id) on delete restrict,
  linked_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint chat_issue_link_source_shape check (
    (source_type = 'group' and group_id is not null and dm_thread_id is null and dm_message_id is null)
    or
    (source_type = 'dm' and dm_thread_id is not null and group_id is null and group_message_id is null)
  )
);

create unique index if not exists chat_issue_links_group_unique
  on public.chat_issue_links(issue_id, group_message_id)
  where source_type = 'group' and group_message_id is not null;
create unique index if not exists chat_issue_links_dm_unique
  on public.chat_issue_links(issue_id, dm_message_id)
  where source_type = 'dm' and dm_message_id is not null;
create index if not exists chat_issue_links_issue_idx on public.chat_issue_links(issue_id, created_at desc);

create or replace function public.chat_dm_participant(p_thread_id uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.chat_user_enabled(p_user) and exists (
    select 1 from public.chat_dm_threads t
    where t.id = p_thread_id and p_user in (t.user_low, t.user_high)
  );
$$;

revoke all on function public.chat_dm_participant(uuid, uuid) from public;
grant execute on function public.chat_dm_participant(uuid, uuid) to authenticated, service_role;

alter table public.chat_dm_devices enable row level security;
alter table public.chat_dm_threads enable row level security;
alter table public.chat_dm_messages enable row level security;
alter table public.chat_dm_envelopes enable row level security;
alter table public.chat_issue_links enable row level security;

revoke insert, update, delete, truncate on public.chat_dm_devices from anon, authenticated;
revoke insert, update, delete, truncate on public.chat_dm_threads from anon, authenticated;
revoke insert, update, delete, truncate on public.chat_dm_messages from anon, authenticated;
revoke insert, update, delete, truncate on public.chat_dm_envelopes from anon, authenticated;
revoke insert, update, delete, truncate on public.chat_issue_links from anon, authenticated;
grant select on public.chat_dm_devices to authenticated;
grant select on public.chat_dm_threads to authenticated;
grant select on public.chat_dm_messages to authenticated;
grant select on public.chat_dm_envelopes to authenticated;
grant select on public.chat_issue_links to authenticated;

drop policy if exists chat_dm_devices_self_select on public.chat_dm_devices;
create policy chat_dm_devices_self_select on public.chat_dm_devices
for select to authenticated
using (auth_user_id = auth.uid());

drop policy if exists chat_dm_threads_participant_select on public.chat_dm_threads;
create policy chat_dm_threads_participant_select on public.chat_dm_threads
for select to authenticated
using (public.chat_dm_participant(id, auth.uid()));

drop policy if exists chat_dm_messages_participant_select on public.chat_dm_messages;
create policy chat_dm_messages_participant_select on public.chat_dm_messages
for select to authenticated
using (expires_at > now() and public.chat_dm_participant(thread_id, auth.uid()));

drop policy if exists chat_dm_envelopes_recipient_select on public.chat_dm_envelopes;
create policy chat_dm_envelopes_recipient_select on public.chat_dm_envelopes
for select to authenticated
using (recipient_user_id = auth.uid());

drop policy if exists chat_issue_links_scoped_select on public.chat_issue_links;
create policy chat_issue_links_scoped_select on public.chat_issue_links
for select to authenticated
using (
  public.is_hotel_member(hotel_id)
  and (
    (source_type = 'group' and group_id is not null and public.chat_group_member(group_id, auth.uid()))
    or
    (source_type = 'dm' and dm_thread_id is not null and public.chat_dm_participant(dm_thread_id, auth.uid()))
  )
);

create or replace function public.chat_dm_register_device(
  p_device_id uuid,
  p_encryption_public_key_jwk jsonb,
  p_signing_public_key_jwk jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.chat_dm_devices;
begin
  if v_user is null or not public.chat_user_enabled(v_user) then
    raise exception 'RandChat non abilitata';
  end if;
  if p_device_id is null then raise exception 'device_id mancante'; end if;
  if coalesce(p_encryption_public_key_jwk->>'kty','') <> 'EC'
     or coalesce(p_encryption_public_key_jwk->>'crv','') <> 'P-256'
     or coalesce(p_signing_public_key_jwk->>'kty','') <> 'EC'
     or coalesce(p_signing_public_key_jwk->>'crv','') <> 'P-256' then
    raise exception 'Chiave dispositivo non valida';
  end if;

  select * into v_existing
  from public.chat_dm_devices
  where auth_user_id = v_user and device_id = p_device_id
  for update;

  if found then
    if v_existing.encryption_public_key_jwk is distinct from p_encryption_public_key_jwk
       or v_existing.signing_public_key_jwk is distinct from p_signing_public_key_jwk then
      raise exception 'Identità crittografica dispositivo non corrispondente';
    end if;
    update public.chat_dm_devices
    set last_seen_at = now(), revoked_at = null
    where id = v_existing.id;
    return v_existing.id;
  end if;

  insert into public.chat_dm_devices(
    auth_user_id, device_id, encryption_public_key_jwk, signing_public_key_jwk
  ) values (
    v_user, p_device_id, p_encryption_public_key_jwk, p_signing_public_key_jwk
  ) returning id into v_existing.id;

  return v_existing.id;
end;
$$;

create or replace function public.chat_dm_revoke_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Non autenticato'; end if;
  update public.chat_dm_devices
  set revoked_at = now(), last_seen_at = now()
  where auth_user_id = v_user and device_id = p_device_id and revoked_at is null;
end;
$$;

create or replace function public.chat_dm_open_thread(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_thread uuid;
begin
  if v_user is null or not public.chat_user_enabled(v_user) then raise exception 'RandChat non abilitata'; end if;
  if p_other_user_id is null or p_other_user_id = v_user then raise exception 'Destinatario DM non valido'; end if;
  if not public.chat_user_enabled(p_other_user_id) then raise exception 'Destinatario non abilitato a RandChat'; end if;

  if v_user::text < p_other_user_id::text then v_low := v_user; v_high := p_other_user_id;
  else v_low := p_other_user_id; v_high := v_user; end if;

  insert into public.chat_dm_threads(user_low, user_high, created_by)
  values (v_low, v_high, v_user)
  on conflict (user_low, user_high) do update set updated_at = public.chat_dm_threads.updated_at
  returning id into v_thread;

  return v_thread;
end;
$$;

create or replace function public.chat_dm_list_threads()
returns table(
  id uuid,
  other_user_id uuid,
  other_display_name text,
  retention_days smallint,
  updated_at timestamptz,
  last_message_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not public.chat_user_enabled(v_user) then raise exception 'RandChat non abilitata'; end if;
  return query
  select
    t.id,
    case when t.user_low = v_user then t.user_high else t.user_low end as other_user_id,
    p.display_name as other_display_name,
    t.retention_days,
    t.updated_at,
    (select max(m.created_at) from public.chat_dm_messages m where m.thread_id=t.id and m.expires_at>now()) as last_message_at
  from public.chat_dm_threads t
  join public.profiles p on p.auth_user_id = case when t.user_low = v_user then t.user_high else t.user_low end
  where v_user in (t.user_low, t.user_high)
    and p.active = true and p.chat_enabled = true
  order by coalesce((select max(m.created_at) from public.chat_dm_messages m where m.thread_id=t.id and m.expires_at>now()), t.updated_at) desc;
end;
$$;

create or replace function public.chat_dm_list_devices(p_thread_id uuid)
returns table(
  device_row_id uuid,
  auth_user_id uuid,
  device_id uuid,
  encryption_public_key_jwk jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user uuid := auth.uid(); v_low uuid; v_high uuid;
begin
  if not public.chat_dm_participant(p_thread_id, v_user) then raise exception 'Accesso DM non consentito'; end if;
  select t.user_low,t.user_high into v_low,v_high from public.chat_dm_threads t where t.id=p_thread_id;
  return query
  select d.id,d.auth_user_id,d.device_id,d.encryption_public_key_jwk
  from public.chat_dm_devices d
  where d.auth_user_id in (v_low,v_high) and d.revoked_at is null
  order by d.auth_user_id,d.created_at;
end;
$$;

create or replace function public.chat_dm_send_message(
  p_thread_id uuid,
  p_message_id uuid,
  p_sender_device_id uuid,
  p_ciphertext text,
  p_content_iv text,
  p_ephemeral_public_key_jwk jsonb,
  p_signature text,
  p_envelopes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_retention smallint;
  v_active_count integer;
  v_active_users integer;
  v_input_count integer;
  v_distinct_count integer;
begin
  if not public.chat_dm_participant(p_thread_id, v_user) then raise exception 'Accesso DM non consentito'; end if;
  if p_message_id is null then raise exception 'message_id mancante'; end if;
  if char_length(coalesce(p_ciphertext,'')) not between 1 and 24000 then raise exception 'Ciphertext non valido'; end if;
  if char_length(coalesce(p_signature,'')) not between 16 and 1024 then raise exception 'Firma non valida'; end if;
  if coalesce(p_ephemeral_public_key_jwk->>'kty','') <> 'EC' or coalesce(p_ephemeral_public_key_jwk->>'crv','') <> 'P-256' then
    raise exception 'Chiave effimera non valida';
  end if;
  if jsonb_typeof(p_envelopes) <> 'array' then raise exception 'Envelope dispositivi non valide'; end if;

  select t.user_low,t.user_high,t.retention_days into v_low,v_high,v_retention
  from public.chat_dm_threads t where t.id=p_thread_id for update;

  if not exists (
    select 1 from public.chat_dm_devices d
    where d.id=p_sender_device_id and d.auth_user_id=v_user and d.revoked_at is null
  ) then raise exception 'Dispositivo mittente non registrato'; end if;

  select count(*)::integer,count(distinct d.auth_user_id)::integer
    into v_active_count,v_active_users
  from public.chat_dm_devices d
  where d.auth_user_id in (v_low,v_high) and d.revoked_at is null;

  if v_active_users < 2 then
    raise exception 'Il destinatario deve aprire RandChat almeno una volta prima di ricevere DM E2EE';
  end if;

  select count(*)::integer,count(distinct x.device_id)::integer
    into v_input_count,v_distinct_count
  from jsonb_to_recordset(p_envelopes) as x(device_id uuid, wrapped_key text, wrap_iv text);

  if v_input_count <> v_active_count or v_distinct_count <> v_active_count then
    raise exception 'Ogni dispositivo attivo deve ricevere una envelope';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_envelopes) as x(device_id uuid, wrapped_key text, wrap_iv text)
    left join public.chat_dm_devices d on d.id=x.device_id and d.revoked_at is null and d.auth_user_id in (v_low,v_high)
    where d.id is null or char_length(coalesce(x.wrapped_key,'')) not between 16 and 4096 or char_length(coalesce(x.wrap_iv,'')) not between 8 and 128
  ) then raise exception 'Envelope dispositivo non valida'; end if;

  if exists (
    select 1 from public.chat_dm_devices d
    where d.auth_user_id in (v_low,v_high) and d.revoked_at is null
      and not exists (
        select 1 from jsonb_to_recordset(p_envelopes) as x(device_id uuid, wrapped_key text, wrap_iv text)
        where x.device_id=d.id
      )
  ) then raise exception 'Envelope mancante per un dispositivo attivo'; end if;

  insert into public.chat_dm_messages(
    id,thread_id,sender_user_id,sender_device_id,ciphertext,content_iv,
    ephemeral_public_key_jwk,signature,expires_at
  ) values (
    p_message_id,p_thread_id,v_user,p_sender_device_id,p_ciphertext,p_content_iv,
    p_ephemeral_public_key_jwk,p_signature,now()+make_interval(days=>v_retention::integer)
  );

  insert into public.chat_dm_envelopes(message_id,device_row_id,recipient_user_id,wrapped_key,wrap_iv)
  select p_message_id,d.id,d.auth_user_id,x.wrapped_key,x.wrap_iv
  from jsonb_to_recordset(p_envelopes) as x(device_id uuid, wrapped_key text, wrap_iv text)
  join public.chat_dm_devices d on d.id=x.device_id;

  update public.chat_dm_threads set updated_at=now() where id=p_thread_id;
  return p_message_id;
end;
$$;

create or replace function public.chat_dm_list_messages(
  p_thread_id uuid,
  p_device_id uuid,
  p_limit integer default 120
)
returns table(
  id uuid,
  thread_id uuid,
  sender_user_id uuid,
  sender_device_id uuid,
  ciphertext text,
  content_iv text,
  ephemeral_public_key_jwk jsonb,
  signature text,
  created_at timestamptz,
  expires_at timestamptz,
  wrapped_key text,
  wrap_iv text,
  sender_signing_public_key_jwk jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_device_row uuid;
  v_limit integer := least(greatest(coalesce(p_limit,120),1),300);
begin
  if not public.chat_dm_participant(p_thread_id, v_user) then raise exception 'Accesso DM non consentito'; end if;
  select d.id into v_device_row
  from public.chat_dm_devices d
  where d.auth_user_id=v_user and d.device_id=p_device_id and d.revoked_at is null;
  if v_device_row is null then raise exception 'Dispositivo locale non registrato'; end if;

  update public.chat_dm_devices set last_seen_at=now() where id=v_device_row;

  return query
  select q.id,q.thread_id,q.sender_user_id,q.sender_device_id,q.ciphertext,q.content_iv,
    q.ephemeral_public_key_jwk,q.signature,q.created_at,q.expires_at,
    e.wrapped_key,e.wrap_iv,sd.signing_public_key_jwk
  from (
    select m.* from public.chat_dm_messages m
    where m.thread_id=p_thread_id and m.expires_at>now()
    order by m.created_at desc
    limit v_limit
  ) q
  left join public.chat_dm_envelopes e on e.message_id=q.id and e.device_row_id=v_device_row
  join public.chat_dm_devices sd on sd.id=q.sender_device_id
  order by q.created_at asc;
end;
$$;

create or replace function public.chat_dm_set_retention(p_thread_id uuid, p_retention_days smallint)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user uuid := auth.uid();
begin
  if not public.chat_dm_participant(p_thread_id, v_user) then raise exception 'Accesso DM non consentito'; end if;
  if p_retention_days not in (1,7,15) then raise exception 'Retention DM non valida'; end if;
  update public.chat_dm_threads set retention_days=p_retention_days,updated_at=now() where id=p_thread_id;
  update public.chat_dm_messages
  set expires_at=created_at+make_interval(days=>p_retention_days::integer)
  where thread_id=p_thread_id;
end;
$$;

create or replace function public.cleanup_expired_dm_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted integer;
begin
  delete from public.chat_dm_messages where expires_at<=now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.chat_link_issue(
  p_source_type text,
  p_source_id uuid,
  p_source_message_id uuid,
  p_issue_id uuid,
  p_hotel_id text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_link uuid;
begin
  if v_user is null then raise exception 'Non autenticato'; end if;
  if not public.is_hotel_member(p_hotel_id, v_user) then raise exception 'Struttura non consentita'; end if;
  if not exists (select 1 from public.segnalazioni s where s.id=p_issue_id and s.hotel_id=p_hotel_id and s.deleted_at is null) then
    raise exception 'Segnalazione non trovata';
  end if;

  if p_source_type='group' then
    if not public.chat_group_member(p_source_id, v_user) then raise exception 'Gruppo non consentito'; end if;
    if not exists (select 1 from public.chat_messages m where m.id=p_source_message_id and m.group_id=p_source_id) then raise exception 'Messaggio gruppo non trovato'; end if;
    insert into public.chat_issue_links(source_type,group_id,group_message_id,issue_id,hotel_id,linked_by)
    values ('group',p_source_id,p_source_message_id,p_issue_id,p_hotel_id,v_user)
    on conflict do nothing returning id into v_link;
  elsif p_source_type='dm' then
    if not public.chat_dm_participant(p_source_id, v_user) then raise exception 'DM non consentito'; end if;
    if not exists (select 1 from public.chat_dm_messages m where m.id=p_source_message_id and m.thread_id=p_source_id) then raise exception 'Messaggio DM non trovato'; end if;
    insert into public.chat_issue_links(source_type,dm_thread_id,dm_message_id,issue_id,hotel_id,linked_by)
    values ('dm',p_source_id,p_source_message_id,p_issue_id,p_hotel_id,v_user)
    on conflict do nothing returning id into v_link;
  else
    raise exception 'Tipo sorgente chat non valido';
  end if;

  if v_link is null then
    select l.id into v_link from public.chat_issue_links l
    where l.issue_id=p_issue_id
      and ((p_source_type='group' and l.group_message_id=p_source_message_id)
        or (p_source_type='dm' and l.dm_message_id=p_source_message_id))
    limit 1;
  end if;
  return v_link;
end;
$$;

revoke all on function public.chat_dm_register_device(uuid,jsonb,jsonb) from public, anon;
revoke all on function public.chat_dm_revoke_device(uuid) from public, anon;
revoke all on function public.chat_dm_open_thread(uuid) from public, anon;
revoke all on function public.chat_dm_list_threads() from public, anon;
revoke all on function public.chat_dm_list_devices(uuid) from public, anon;
revoke all on function public.chat_dm_send_message(uuid,uuid,uuid,text,text,jsonb,text,jsonb) from public, anon;
revoke all on function public.chat_dm_list_messages(uuid,uuid,integer) from public, anon;
revoke all on function public.chat_dm_set_retention(uuid,smallint) from public, anon;
revoke all on function public.cleanup_expired_dm_messages() from public, anon, authenticated;
revoke all on function public.chat_link_issue(text,uuid,uuid,uuid,text) from public, anon;

grant execute on function public.chat_dm_register_device(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.chat_dm_revoke_device(uuid) to authenticated;
grant execute on function public.chat_dm_open_thread(uuid) to authenticated;
grant execute on function public.chat_dm_list_threads() to authenticated;
grant execute on function public.chat_dm_list_devices(uuid) to authenticated;
grant execute on function public.chat_dm_send_message(uuid,uuid,uuid,text,text,jsonb,text,jsonb) to authenticated;
grant execute on function public.chat_dm_list_messages(uuid,uuid,integer) to authenticated;
grant execute on function public.chat_dm_set_retention(uuid,smallint) to authenticated;
grant execute on function public.cleanup_expired_dm_messages() to service_role;
grant execute on function public.chat_link_issue(text,uuid,uuid,uuid,text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.chat_dm_messages;
exception when duplicate_object then null; end $$;

do $$ begin
  perform cron.unschedule('randchat-dm-retention-hourly');
exception when others then null; end $$;

select cron.schedule(
  'randchat-dm-retention-hourly',
  '15 * * * *',
  $$ select public.cleanup_expired_dm_messages(); $$
);

comment on table public.chat_dm_devices is 'Per-device E2EE public keys. Private keys remain client-side only.';
comment on table public.chat_dm_messages is 'Ciphertext-only direct messages. No plaintext body column exists by design.';
comment on table public.chat_issue_links is 'Metadata-only link between a chat source and a promoted persistent issue.';
