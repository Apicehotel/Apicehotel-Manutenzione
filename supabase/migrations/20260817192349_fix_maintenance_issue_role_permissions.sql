drop policy if exists issues_staff_update on public.maintenance_issues;
create policy issues_staff_update
on public.maintenance_issues
for update
to authenticated
using (
  public.has_hotel_role(
    hotel_id,
    array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore','Tecnico esterno']::text[]
  )
)
with check (
  public.has_hotel_role(
    hotel_id,
    array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore','Tecnico esterno']::text[]
  )
);
