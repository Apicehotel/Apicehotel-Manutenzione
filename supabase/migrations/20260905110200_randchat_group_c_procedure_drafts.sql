-- Group C completion: operational group content can become a canonical RandGuide
-- draft, but never an approved/published procedure automatically.

create or replace function public.chat_create_procedure_draft(
  p_group_id uuid,
  p_message_id uuid,
  p_title text,
  p_summary text,
  p_steps jsonb default '[]'::jsonb,
  p_category text default 'generale',
  p_area text default null
)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_hotel text;
  v_message public.chat_messages;
  v_id text := 'chat-draft-' || replace(gen_random_uuid()::text,'-','');
  v_title text := left(btrim(coalesce(p_title,'')),120);
  v_summary text := left(btrim(coalesce(p_summary,'')),1200);
  v_category text := left(coalesce(nullif(btrim(p_category),''),'generale'),80);
  v_steps jsonb := coalesce(p_steps,'[]'::jsonb);
begin
  if not public.chat_group_member(p_group_id,v_user) then raise exception 'Gruppo non consentito'; end if;
  select g.hotel_id into v_hotel from public.chat_groups g where g.id=p_group_id and g.archived_at is null;
  if v_hotel is null or not public.is_hotel_member(v_hotel,v_user) then
    raise exception 'Inserimento procedure richiede appartenenza alla struttura del gruppo';
  end if;
  select * into v_message from public.chat_messages m where m.id=p_message_id and m.group_id=p_group_id;
  if not found then raise exception 'Messaggio sorgente non trovato'; end if;
  if char_length(v_title) < 3 then raise exception 'Titolo procedura troppo breve'; end if;
  if char_length(v_summary) < 3 then raise exception 'Sintesi procedura troppo breve'; end if;
  if jsonb_typeof(v_steps) <> 'array' or jsonb_array_length(v_steps) > 50 then raise exception 'Passaggi procedura non validi'; end if;

  insert into public.randai_procedures(
    id,hotel_id,title,category,area,summary,steps,source_label,status,version,
    procedure_kind,risk_level,source_confidence,keywords,location_path,equipment_ids
  ) values (
    v_id,v_hotel,v_title,v_category,nullif(left(btrim(coalesce(p_area,'')),120),''),v_summary,v_steps,
    'Bozza da RandChat · revisione umana obbligatoria','draft',1,
    'procedure','normal',70,'{}'::text[],'{}'::text[],'{}'::text[]
  );

  perform public.chat_write_audit(
    v_hotel,'procedure_draft_created','randai_procedure',v_id,
    jsonb_build_object('group_id',p_group_id,'message_id',p_message_id,'requires_approval',true),v_user
  );
  return v_id;
end;
$$;

-- Replace the AI context function with a deterministic aggregate ordering.
create or replace function public.chat_group_ai_context(p_group_id uuid, p_limit integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_group public.chat_groups;
  v_limit integer := least(greatest(coalesce(p_limit,30),1),50);
  v_messages jsonb;
  v_procedures jsonb;
  v_issues jsonb;
begin
  if not public.chat_group_member(p_group_id,v_user) then raise exception 'Gruppo non consentito'; end if;
  select * into v_group from public.chat_groups where id=p_group_id and archived_at is null;
  if not found or not public.is_hotel_member(v_group.hotel_id,v_user) then
    raise exception 'RandAI richiede appartenenza alla struttura del gruppo';
  end if;

  select coalesce(jsonb_agg(q.payload order by q.created_at),'[]'::jsonb)
  into v_messages
  from (
    select m.created_at,
      jsonb_build_object(
        'id',m.id,'sender',coalesce(p.display_name,'Utente'),'body',left(m.body,4000),'created_at',m.created_at
      ) as payload
    from public.chat_messages m
    left join public.profiles p on p.auth_user_id=m.sender_user_id
    where m.group_id=p_group_id
    order by m.created_at desc
    limit v_limit
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object(
    'message_id',l.group_message_id,'procedure_id',l.procedure_id,'version',l.procedure_version,
    'snapshot',l.procedure_snapshot
  ) order by l.created_at),'[]'::jsonb)
  into v_procedures
  from public.chat_procedure_links l where l.group_id=p_group_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'message_id',l.group_message_id,'issue_id',l.issue_id
  ) order by l.created_at),'[]'::jsonb)
  into v_issues
  from public.chat_issue_links l where l.source_type='group' and l.group_id=p_group_id;

  return jsonb_build_object(
    'group_id',v_group.id,'group_name',v_group.name,'hotel_id',v_group.hotel_id,
    'messages',v_messages,'procedures',v_procedures,'issue_links',v_issues
  );
end;
$$;

revoke all on function public.chat_create_procedure_draft(uuid,uuid,text,text,jsonb,text,text) from public,anon;
revoke all on function public.chat_group_ai_context(uuid,integer) from public,anon;
grant execute on function public.chat_create_procedure_draft(uuid,uuid,text,text,jsonb,text,text) to authenticated;
grant execute on function public.chat_group_ai_context(uuid,integer) to authenticated;

comment on function public.chat_create_procedure_draft(uuid,uuid,text,text,jsonb,text,text)
is 'Creates a canonical RandGuide draft from an authorized operational group message. Never publishes or approves it.';
