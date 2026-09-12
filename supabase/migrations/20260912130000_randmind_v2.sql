-- RandMind v2: temporal supersession + verified audit provenance + governed conflict resolution.
alter table public.randai_memory_items add column if not exists superseded_at timestamptz;

create index if not exists randmind_temporal_idx on public.randai_memory_items(hotel_id,valid_from,valid_until,superseded_at,forgotten_at);
create unique index if not exists randmind_verified_audit_dedupe_idx
  on public.randai_memory_items(scope,coalesce(hotel_id,''),source_kind,source_id,content_hash)
  where source_kind='governance_audit';

create or replace function public.randmind_stamp_supersession_internal()
returns trigger language plpgsql security definer set search_path=public,pg_catalog as $$
begin
  if new.supersedes_id is not null then
    update public.randai_memory_items set superseded_at=coalesce(superseded_at,now()),updated_at=now()
    where id=new.supersedes_id and lifecycle_status='superseded';
  end if;
  return new;
end; $$;
drop trigger if exists randmind_stamp_supersession on public.randai_memory_items;
create trigger randmind_stamp_supersession after insert or update of supersedes_id on public.randai_memory_items
for each row execute function public.randmind_stamp_supersession_internal();
revoke all on function public.randmind_stamp_supersession_internal() from public,anon,authenticated;

create or replace function public.randmind_resolve_conflict(p_conflict_group text,p_winner_id text,p_loser_ids text[],p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_winner public.randai_memory_items; v_allowed boolean:=false; v_count integer:=0;
begin
  if coalesce(length(btrim(p_conflict_group)),0)=0 then raise exception 'randmind_conflict_group_required'; end if;
  if coalesce(length(btrim(p_reason)),0)<3 then raise exception 'randmind_resolution_reason_required'; end if;
  if p_loser_ids is null or cardinality(p_loser_ids)=0 then raise exception 'randmind_losers_required'; end if;
  select * into v_winner from public.randai_memory_items where id=p_winner_id and conflict_group=p_conflict_group and lifecycle_status='active' for update;
  if not found then raise exception 'randmind_conflict_winner_not_found'; end if;
  if v_winner.scope='hotel' then v_allowed:=public.can_manage_randai_hotel(v_winner.hotel_id);
  else select exists(select 1 from public.hotels h where public.has_hotel_role(h.id,array['RandAI'::text])) into v_allowed; end if;
  if not v_allowed then raise exception 'randmind_not_authorized'; end if;
  if p_winner_id=any(p_loser_ids) then raise exception 'randmind_winner_cannot_be_loser'; end if;
  update public.randai_memory_items set lifecycle_status='superseded',trust='outdated',superseded_at=now(),valid_until=coalesce(valid_until,now()),updated_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('conflict_resolution_reason',btrim(p_reason),'conflict_winner_id',p_winner_id)
  where id=any(p_loser_ids) and conflict_group=p_conflict_group and lifecycle_status='active'
    and scope=v_winner.scope and coalesce(hotel_id,'')=coalesce(v_winner.hotel_id,'') and coalesce(project_id,'')=coalesce(v_winner.project_id,'') and coalesce(task_id,'')=coalesce(v_winner.task_id,'');
  get diagnostics v_count=row_count;
  if v_count<>cardinality(p_loser_ids) then raise exception 'randmind_conflict_scope_or_state_mismatch'; end if;
  update public.randai_memory_items set last_verified_at=now(),updated_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('conflict_resolution_reason',btrim(p_reason),'conflict_resolved_count',v_count) where id=p_winner_id;
  return jsonb_build_object('winner_id',p_winner_id,'superseded_count',v_count,'conflict_group',p_conflict_group);
end; $$;
revoke all on function public.randmind_resolve_conflict(text,text,text[],text) from public,anon;
grant execute on function public.randmind_resolve_conflict(text,text,text[],text) to authenticated,service_role;
