create or replace function public.whatsapp_ignore_inbound(p_message_id uuid)
returns public.whatsapp_inbound_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  msg public.whatsapp_inbound_messages;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into msg from public.whatsapp_inbound_messages where id = p_message_id for update;
  if msg.id is null then raise exception 'message not found'; end if;
  if not exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = auth.uid() and hm.hotel_id = msg.hotel_id
      and hm.active = true and hm.can_access_admin = true
  ) then raise exception 'not authorized'; end if;
  if msg.processing_status in ('created','linked','ignored') then raise exception 'message already finalized'; end if;
  update public.whatsapp_inbound_messages
     set processing_status='ignored', processed_at=now()
   where id=p_message_id
   returning * into msg;
  return msg;
end;
$$;

create or replace function public.whatsapp_link_inbound(p_message_id uuid, p_issue_id uuid)
returns public.whatsapp_inbound_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  msg public.whatsapp_inbound_messages;
  issue_hotel text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into msg from public.whatsapp_inbound_messages where id = p_message_id for update;
  if msg.id is null then raise exception 'message not found'; end if;
  if not exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = auth.uid() and hm.hotel_id = msg.hotel_id
      and hm.active = true and hm.can_access_admin = true
  ) then raise exception 'not authorized'; end if;
  if msg.processing_status in ('created','linked','ignored') then raise exception 'message already finalized'; end if;
  select hotel_id into issue_hotel from public.segnalazioni where id=p_issue_id and deleted_at is null;
  if issue_hotel is null then raise exception 'issue not found'; end if;
  if issue_hotel <> msg.hotel_id then raise exception 'cross-hotel link denied'; end if;
  update public.whatsapp_inbound_messages
     set processing_status='linked', issue_id=p_issue_id, processed_at=now()
   where id=p_message_id
   returning * into msg;
  return msg;
end;
$$;

create or replace function public.whatsapp_create_issue_from_inbound(
  p_message_id uuid,
  p_location text,
  p_problem text,
  p_category text default 'Varie',
  p_urgency text default 'media'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  msg public.whatsapp_inbound_messages;
  new_issue_id uuid;
  clean_location text := btrim(coalesce(p_location,''));
  clean_problem text := btrim(coalesce(p_problem,''));
  clean_category text := initcap(lower(btrim(coalesce(p_category,'Varie'))));
  clean_urgency text := lower(btrim(coalesce(p_urgency,'media')));
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into msg from public.whatsapp_inbound_messages where id = p_message_id for update;
  if msg.id is null then raise exception 'message not found'; end if;
  if not exists (
    select 1 from public.hotel_memberships hm
    where hm.auth_user_id = auth.uid() and hm.hotel_id = msg.hotel_id
      and hm.active = true and hm.can_access_admin = true
  ) then raise exception 'not authorized'; end if;
  if msg.processing_status in ('created','linked','ignored') then raise exception 'message already finalized'; end if;
  if clean_location = '' or clean_problem = '' then raise exception 'location and problem are required'; end if;
  if clean_category not in ('Arredo','Climatizzazione','Edilizio','Elettrico','Idraulico','Varie') then clean_category := 'Varie'; end if;
  if clean_urgency not in ('bassa','media','alta','urgente') then clean_urgency := 'media'; end if;

  insert into public.segnalazioni(
    hotel_id,camera,urgenza,categoria,stato,note,foto_prima,creato_da,origine,created_by_user_id
  ) values (
    msg.hotel_id,clean_location,clean_urgency,clean_category,'todo',left(clean_problem,2000),
    msg.media_storage_path,'WhatsApp · revisione RandAI','WhatsApp',auth.uid()
  ) returning id into new_issue_id;

  update public.whatsapp_inbound_messages
     set processing_status='created', issue_id=new_issue_id, processed_at=now(),
         metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('manual_creation',true,'manual_actor',auth.uid())
   where id=p_message_id;
  return new_issue_id;
end;
$$;

revoke all on function public.whatsapp_ignore_inbound(uuid) from public, anon;
revoke all on function public.whatsapp_link_inbound(uuid,uuid) from public, anon;
revoke all on function public.whatsapp_create_issue_from_inbound(uuid,text,text,text,text) from public, anon;
grant execute on function public.whatsapp_ignore_inbound(uuid) to authenticated;
grant execute on function public.whatsapp_link_inbound(uuid,uuid) to authenticated;
grant execute on function public.whatsapp_create_issue_from_inbound(uuid,text,text,text,text) to authenticated;
