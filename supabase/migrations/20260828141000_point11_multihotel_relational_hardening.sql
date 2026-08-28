-- Punto 11: Multi-hotel blindato. Il database rende hotel_id una invariante relazionale.

alter table public.tecnici alter column hotel_id set not null;
alter table public.notification_outbox alter column hotel_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='promemoria_hotel_id_fkey') then alter table public.promemoria add constraint promemoria_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='promemoria_invio_hotel_id_fkey') then alter table public.promemoria_invio add constraint promemoria_invio_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='notification_reads_hotel_id_fkey') then alter table public.notification_reads add constraint notification_reads_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='diagnostic_events_hotel_id_fkey') then alter table public.diagnostic_events add constraint diagnostic_events_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='sale_rooms_config_hotel_id_fkey') then alter table public.sale_rooms_config add constraint sale_rooms_config_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='sale_clients_hotel_id_fkey') then alter table public.sale_clients add constraint sale_clients_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='sale_layouts_config_hotel_id_fkey') then alter table public.sale_layouts_config add constraint sale_layouts_config_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='richieste_urgenti_eventi_hotel_id_fkey') then alter table public.richieste_urgenti_eventi add constraint richieste_urgenti_eventi_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='urgent_reminder_jobs_hotel_id_fkey') then alter table public.urgent_reminder_jobs add constraint urgent_reminder_jobs_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='weather_alert_state_hotel_id_fkey') then alter table public.weather_alert_state add constraint weather_alert_state_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade; end if;
end $$;

create unique index if not exists maintenance_issues_id_hotel_uidx on public.maintenance_issues(id, hotel_id);
create unique index if not exists richieste_urgenti_id_hotel_uidx on public.richieste_urgenti(id, hotel_id);
create unique index if not exists promemoria_id_hotel_uidx on public.promemoria(id, hotel_id);
create unique index if not exists import_camere_id_hotel_uidx on public.import_camere(id, hotel_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='issue_attachments_issue_hotel_fkey') then alter table public.issue_attachments add constraint issue_attachments_issue_hotel_fkey foreign key (issue_id, hotel_id) references public.maintenance_issues(id, hotel_id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='issue_events_issue_hotel_fkey') then alter table public.issue_events add constraint issue_events_issue_hotel_fkey foreign key (issue_id, hotel_id) references public.maintenance_issues(id, hotel_id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='richieste_urgenti_eventi_urgent_hotel_fkey') then alter table public.richieste_urgenti_eventi add constraint richieste_urgenti_eventi_urgent_hotel_fkey foreign key (urgente_id, hotel_id) references public.richieste_urgenti(id, hotel_id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='urgent_reminder_jobs_urgent_hotel_fkey') then alter table public.urgent_reminder_jobs add constraint urgent_reminder_jobs_urgent_hotel_fkey foreign key (urgent_id, hotel_id) references public.richieste_urgenti(id, hotel_id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='promemoria_invio_reminder_hotel_fkey') then alter table public.promemoria_invio add constraint promemoria_invio_reminder_hotel_fkey foreign key (promemoria_id, hotel_id) references public.promemoria(id, hotel_id) on delete cascade; end if;
end $$;

alter table public.planning_lavori_giorni add column if not exists hotel_id text;
update public.planning_lavori_giorni g set hotel_id=p.hotel_id from public.planning_lavori p where p.id=g.lavoro_id and g.hotel_id is null;

create or replace function public.enforce_planning_day_hotel()
returns trigger language plpgsql set search_path=public as $$
declare v_hotel text;
begin
  select hotel_id into v_hotel from public.planning_lavori where id=new.lavoro_id;
  if v_hotel is null then raise exception 'Planning padre inesistente' using errcode='23503'; end if;
  if new.hotel_id is null then new.hotel_id := v_hotel; end if;
  if new.hotel_id <> v_hotel then raise exception 'Cross-hotel planning non consentito' using errcode='23514'; end if;
  return new;
end $$;

drop trigger if exists planning_day_hotel_guard on public.planning_lavori_giorni;
create trigger planning_day_hotel_guard before insert or update of lavoro_id, hotel_id on public.planning_lavori_giorni for each row execute function public.enforce_planning_day_hotel();
alter table public.planning_lavori_giorni alter column hotel_id set not null;
create index if not exists planning_lavori_giorni_hotel_data_idx on public.planning_lavori_giorni(hotel_id, data, lavoro_id);
do $$ begin if not exists (select 1 from pg_constraint where conname='planning_lavori_giorni_hotel_id_fkey') then alter table public.planning_lavori_giorni add constraint planning_lavori_giorni_hotel_id_fkey foreign key (hotel_id) references public.hotels(id) on delete cascade; end if; end $$;

drop policy if exists planning_lavori_giorni_member_select on public.planning_lavori_giorni;
drop policy if exists planning_lavori_giorni_staff_insert on public.planning_lavori_giorni;
drop policy if exists planning_lavori_giorni_staff_update on public.planning_lavori_giorni;
drop policy if exists planning_lavori_giorni_staff_delete on public.planning_lavori_giorni;
create policy planning_lavori_giorni_permission_select on public.planning_lavori_giorni for select to authenticated using (public.has_app_permission(hotel_id,'planning_work','view'));
create policy planning_lavori_giorni_permission_insert on public.planning_lavori_giorni for insert to authenticated with check (public.has_app_permission(hotel_id,'planning_work','create'));
create policy planning_lavori_giorni_permission_update on public.planning_lavori_giorni for update to authenticated using (public.has_app_permission(hotel_id,'planning_work','edit') or public.has_app_permission(hotel_id,'planning_work','complete')) with check (public.has_app_permission(hotel_id,'planning_work','edit') or public.has_app_permission(hotel_id,'planning_work','complete'));
create policy planning_lavori_giorni_permission_delete on public.planning_lavori_giorni for delete to authenticated using (public.has_app_permission(hotel_id,'planning_work','delete'));

drop policy if exists notification_reads_select_own on public.notification_reads;
drop policy if exists notification_reads_update_own on public.notification_reads;
create policy notification_reads_select_own_hotel on public.notification_reads for select to authenticated using (user_id=auth.uid() and public.is_hotel_member(hotel_id));
create policy notification_reads_update_own_hotel on public.notification_reads for update to authenticated using (user_id=auth.uid() and public.is_hotel_member(hotel_id)) with check (user_id=auth.uid() and public.is_hotel_member(hotel_id));

create index if not exists tecnici_hotel_idx on public.tecnici(hotel_id);
create index if not exists notification_outbox_hotel_status_idx on public.notification_outbox(hotel_id,status,created_at desc);
create index if not exists promemoria_hotel_active_idx on public.promemoria(hotel_id,active,updated_at desc);
create index if not exists notification_reads_hotel_user_idx on public.notification_reads(hotel_id,user_id,read_at desc);
create index if not exists diagnostic_events_hotel_created_idx on public.diagnostic_events(hotel_id,created_at desc);
create index if not exists urgent_jobs_hotel_status_idx on public.urgent_reminder_jobs(hotel_id,status,next_attempt_at);
create index if not exists urgent_events_hotel_created_idx on public.richieste_urgenti_eventi(hotel_id,creato_il desc);
