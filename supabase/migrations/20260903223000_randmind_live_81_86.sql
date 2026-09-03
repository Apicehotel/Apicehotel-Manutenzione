-- Block 23 / points 81-86: promote the existing randai_memory_items domain into canonical RandMind.
-- No second memory store is introduced. Existing MemoryEngine/SupabaseMemoryStore remain authoritative.

alter table public.randai_memory_items
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists retention_class text not null default 'operational',
  add column if not exists valid_from timestamptz,
  add column if not exists valid_until timestamptz,
  add column if not exists last_verified_at timestamptz,
  add column if not exists supersedes_id text,
  add column if not exists conflict_group text,
  add column if not exists content_hash text,
  add column if not exists forgotten_at timestamptz,
  add column if not exists forgotten_by uuid,
  add column if not exists forgotten_reason text;

update public.randai_memory_items
set valid_from=coalesce(valid_from,created_at),
    valid_until=coalesce(valid_until,expires_at),
    last_verified_at=case when trust in ('verified','approved') then coalesce(last_verified_at,updated_at,created_at) else last_verified_at end,
    content_hash=coalesce(content_hash,md5(lower(btrim(content))))
where valid_from is null or content_hash is null or (trust in ('verified','approved') and last_verified_at is null);

alter table public.randai_memory_items alter column valid_from set default now();
alter table public.randai_memory_items alter column valid_from set not null;

alter table public.randai_memory_items drop constraint if exists randai_memory_lifecycle_check;
alter table public.randai_memory_items add constraint randai_memory_lifecycle_check
  check (lifecycle_status in ('active','superseded','forgotten'));
alter table public.randai_memory_items drop constraint if exists randai_memory_retention_check;
alter table public.randai_memory_items add constraint randai_memory_retention_check
  check (retention_class in ('transient','operational','long_term','legal_hold'));
alter table public.randai_memory_items drop constraint if exists randai_memory_validity_check;
alter table public.randai_memory_items add constraint randai_memory_validity_check
  check (valid_until is null or valid_until > valid_from);
alter table public.randai_memory_items drop constraint if exists randai_memory_forget_shape_check;
alter table public.randai_memory_items add constraint randai_memory_forget_shape_check
  check ((lifecycle_status <> 'forgotten') or forgotten_at is not null);
alter table public.randai_memory_items drop constraint if exists randai_memory_transient_expiry_check;
alter table public.randai_memory_items add constraint randai_memory_transient_expiry_check
  check (retention_class <> 'transient' or valid_until is not null or expires_at is not null);

create index if not exists randai_memory_active_hotel_idx
  on public.randai_memory_items(hotel_id,updated_at desc)
  where lifecycle_status='active';
create index if not exists randai_memory_conflict_idx
  on public.randai_memory_items(hotel_id,conflict_group)
  where lifecycle_status='active' and conflict_group is not null;
create index if not exists randai_memory_retention_idx
  on public.randai_memory_items(retention_class,valid_until)
  where lifecycle_status='active';
create index if not exists randai_memory_content_hash_idx
  on public.randai_memory_items(hotel_id,content_hash)
  where lifecycle_status='active';

create or replace function public.randmind_normalize_memory_internal()
returns trigger
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_old public.randai_memory_items;
begin
  new.valid_from:=coalesce(new.valid_from,new.created_at,now());
  new.valid_until:=coalesce(new.valid_until,new.expires_at);
  new.content_hash:=coalesce(nullif(new.content_hash,''),md5(lower(btrim(new.content))));
  if new.trust in ('verified','approved') then new.last_verified_at:=coalesce(new.last_verified_at,now()); end if;
  if new.supersedes_id is not null then
    if new.supersedes_id=new.id then raise exception 'randmind_self_supersession'; end if;
    select * into v_old from public.randai_memory_items where id=new.supersedes_id;
    if not found then raise exception 'randmind_superseded_memory_not_found'; end if;
    if v_old.scope<>new.scope or coalesce(v_old.hotel_id,'')<>coalesce(new.hotel_id,'') or coalesce(v_old.project_id,'')<>coalesce(new.project_id,'') or coalesce(v_old.task_id,'')<>coalesce(new.task_id,'') then
      raise exception 'randmind_cross_scope_supersession_denied';
    end if;
    update public.randai_memory_items set lifecycle_status='superseded',updated_at=now() where id=v_old.id and lifecycle_status='active';
  end if;
  return new;
end;
$$;

drop trigger if exists randmind_normalize_memory on public.randai_memory_items;
create trigger randmind_normalize_memory
before insert or update on public.randai_memory_items
for each row execute function public.randmind_normalize_memory_internal();

create or replace function public.randmind_forget_memory(p_memory_id text,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_row public.randai_memory_items; v_allowed boolean:=false;
begin
  if coalesce(length(btrim(p_reason)),0)<3 then raise exception 'randmind_forget_reason_required'; end if;
  select * into v_row from public.randai_memory_items where id=p_memory_id for update;
  if not found then raise exception 'randmind_memory_not_found'; end if;
  if v_row.retention_class='legal_hold' then raise exception 'randmind_legal_hold'; end if;
  if v_row.scope='hotel' then
    v_allowed:=public.can_manage_randai_hotel(v_row.hotel_id);
  else
    select exists(select 1 from public.hotels h where public.has_hotel_role(h.id,array['RandAI'::text])) into v_allowed;
  end if;
  if not v_allowed then raise exception 'randmind_not_authorized'; end if;
  update public.randai_memory_items
    set lifecycle_status='forgotten',trust='outdated',forgotten_at=now(),forgotten_by=auth.uid(),forgotten_reason=btrim(p_reason),valid_until=coalesce(valid_until,now()),expires_at=coalesce(expires_at,now()),updated_at=now()
    where id=p_memory_id returning * into v_row;
  return jsonb_build_object('id',v_row.id,'lifecycle_status',v_row.lifecycle_status,'forgotten_at',v_row.forgotten_at);
end;
$$;

create or replace function public.randmind_get_console(p_hotel_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_catalog
as $$
begin
  if not (public.is_hotel_member(p_hotel_id) or public.can_manage_randai_hotel(p_hotel_id)) then return null; end if;
  return jsonb_build_object(
    'hotel_id',p_hotel_id,
    'total',(select count(*) from public.randai_memory_items where scope='hotel' and hotel_id=p_hotel_id),
    'active',(select count(*) from public.randai_memory_items where scope='hotel' and hotel_id=p_hotel_id and lifecycle_status='active' and (valid_until is null or valid_until>now())),
    'verified',(select count(*) from public.randai_memory_items where scope='hotel' and hotel_id=p_hotel_id and lifecycle_status='active' and trust in ('verified','approved')),
    'stale',(select count(*) from public.randai_memory_items where scope='hotel' and hotel_id=p_hotel_id and lifecycle_status='active' and valid_until is not null and valid_until<=now()),
    'forgotten',(select count(*) from public.randai_memory_items where scope='hotel' and hotel_id=p_hotel_id and lifecycle_status='forgotten'),
    'conflicts',coalesce((select jsonb_agg(jsonb_build_object('group',conflict_group,'count',c)) from (select conflict_group,count(*) c from public.randai_memory_items where scope='hotel' and hotel_id=p_hotel_id and lifecycle_status='active' and conflict_group is not null group by conflict_group having count(*)>1) q),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'type',type,'trust',trust,'content',content,'summary',summary,'confidence',confidence,'importance',importance,'source_kind',source_kind,'source_id',source_id,'retention_class',retention_class,'lifecycle_status',lifecycle_status,'valid_from',valid_from,'valid_until',valid_until,'last_verified_at',last_verified_at,'conflict_group',conflict_group,'supersedes_id',supersedes_id,'forgotten_at',forgotten_at) order by updated_at desc) from public.randai_memory_items where scope='hotel' and hotel_id=p_hotel_id),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.randmind_forget_memory(text,text) from public,anon;
grant execute on function public.randmind_forget_memory(text,text) to authenticated,service_role;
revoke all on function public.randmind_get_console(text) from public,anon;
grant execute on function public.randmind_get_console(text) to authenticated,service_role;
revoke all on function public.randmind_normalize_memory_internal() from public,anon,authenticated;
