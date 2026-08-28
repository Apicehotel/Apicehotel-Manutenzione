-- Supremo is an operational role, not a global administrator.
-- It can view/create operational records, and may edit only the maintenance issues it created.
-- Ownership is stored by auth user id and remains immutable after insert.

alter table public.segnalazioni
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists segnalazioni_hotel_creator_idx
  on public.segnalazioni (hotel_id, created_by_user_id);

-- Best-effort historical ownership backfill only when the display name resolves to
-- exactly one active authenticated member of the same hotel.
with resolved as (
  select s.id, min(p.auth_user_id::text)::uuid as auth_user_id
  from public.segnalazioni s
  join public.profiles p
    on p.display_name = s.creato_da
   and p.active = true
  join public.hotel_memberships hm
    on hm.auth_user_id = p.auth_user_id
   and hm.hotel_id = s.hotel_id
   and hm.active = true
  where s.created_by_user_id is null
    and s.creato_da is not null
  group by s.id
  having count(distinct p.auth_user_id) = 1
)
update public.segnalazioni s
set created_by_user_id = r.auth_user_id
from resolved r
where r.id = s.id;

alter table public.segnalazioni
  alter column created_by_user_id set default auth.uid();

create or replace function public.enforce_issue_creator_and_supremo_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_supremo boolean := false;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by_user_id := auth.uid();
    end if;
    return new;
  end if;

  -- Creator identity is immutable for every caller.
  new.created_by_user_id := old.created_by_user_id;

  if auth.uid() is not null then
    select exists (
      select 1
      from public.hotel_memberships hm
      where hm.auth_user_id = auth.uid()
        and hm.hotel_id = old.hotel_id
        and hm.active = true
        and hm.role = 'Supremo'
    ) into v_is_supremo;
  end if;

  if v_is_supremo then
    if old.created_by_user_id is distinct from auth.uid() then
      raise exception 'Supremo può modificare soltanto le manutenzioni create da lui' using errcode='42501';
    end if;

    -- Supremo may correct only the issue details it originally reported.
    -- Operational workflow/status/assignment/completion fields remain read-only.
    if (to_jsonb(new) - array['camera','urgenza','categoria','stato_camera','note','foto_prima','updated_at','created_by_user_id'])
       is distinct from
       (to_jsonb(old) - array['camera','urgenza','categoria','stato_camera','note','foto_prima','updated_at','created_by_user_id']) then
      raise exception 'Supremo può modificare solo i dettagli della propria manutenzione' using errcode='42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_issue_creator_and_supremo_edit() from public, anon, authenticated;

drop trigger if exists trg_enforce_issue_creator_and_supremo_edit on public.segnalazioni;
create trigger trg_enforce_issue_creator_and_supremo_edit
before insert or update on public.segnalazioni
for each row execute function public.enforce_issue_creator_and_supremo_edit();

-- Keep the normal central permission matrix. Supremo does NOT receive generic edit.
-- Add only a row-level exception for its own issues; the trigger above limits columns.
drop policy if exists segnalazioni_permission_update on public.segnalazioni;
create policy segnalazioni_permission_update
on public.segnalazioni
for update
using (
  public.has_app_permission(hotel_id, 'issues', 'edit')
  or public.has_app_permission(hotel_id, 'issues', 'take_charge')
  or public.has_app_permission(hotel_id, 'issues', 'complete')
  or public.has_app_permission(hotel_id, 'issues', 'assign')
  or (
    created_by_user_id = (select auth.uid())
    and public.has_hotel_role(hotel_id, array['Supremo']::text[])
  )
)
with check (
  public.has_app_permission(hotel_id, 'issues', 'edit')
  or public.has_app_permission(hotel_id, 'issues', 'take_charge')
  or public.has_app_permission(hotel_id, 'issues', 'complete')
  or public.has_app_permission(hotel_id, 'issues', 'assign')
  or (
    created_by_user_id = (select auth.uid())
    and public.has_hotel_role(hotel_id, array['Supremo']::text[])
  )
);

-- Hardening found while closing Punto 9.
alter function public.enforce_supremo_permission_rule() set search_path = public;
revoke execute on function public.has_app_permission(text,text,text) from public, anon;
grant execute on function public.has_app_permission(text,text,text) to authenticated;
