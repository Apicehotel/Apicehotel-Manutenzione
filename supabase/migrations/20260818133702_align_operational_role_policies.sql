drop policy if exists interventi_staff_insert on public.interventi;
drop policy if exists interventi_staff_update on public.interventi;
drop policy if exists interventi_staff_delete on public.interventi;
create policy interventi_staff_insert on public.interventi for insert to authenticated with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore','Tecnico esterno']::text[]));
create policy interventi_staff_update on public.interventi for update to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore','Tecnico esterno']::text[])) with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore','Tecnico esterno']::text[]));
create policy interventi_staff_delete on public.interventi for delete to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi']::text[]));

drop policy if exists richieste_urgenti_staff_update on public.richieste_urgenti;
create policy richieste_urgenti_staff_update on public.richieste_urgenti for update to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[])) with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[]));

drop policy if exists segnalazioni_staff_update on public.segnalazioni;
create policy segnalazioni_staff_update on public.segnalazioni for update to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore','Tecnico esterno']::text[])) with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore','Tecnico esterno']::text[]));

drop policy if exists tecnici_staff_insert on public.tecnici;
drop policy if exists tecnici_staff_update on public.tecnici;
drop policy if exists tecnici_staff_delete on public.tecnici;
create policy tecnici_staff_insert on public.tecnici for insert to authenticated with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[]));
create policy tecnici_staff_update on public.tecnici for update to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[])) with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[]));
create policy tecnici_staff_delete on public.tecnici for delete to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[]));

drop policy if exists planning_lavori_staff_insert on public.planning_lavori;
drop policy if exists planning_lavori_staff_update on public.planning_lavori;
drop policy if exists planning_lavori_staff_delete on public.planning_lavori;
create policy planning_lavori_staff_insert on public.planning_lavori for insert to authenticated with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[]));
create policy planning_lavori_staff_update on public.planning_lavori for update to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[])) with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi','manutentore']::text[]));
create policy planning_lavori_staff_delete on public.planning_lavori for delete to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi']::text[]));

drop policy if exists prenotazioni_sale_staff_insert on public.prenotazioni_sale;
drop policy if exists prenotazioni_sale_staff_update on public.prenotazioni_sale;
drop policy if exists prenotazioni_sale_staff_delete on public.prenotazioni_sale;
create policy prenotazioni_sale_staff_insert on public.prenotazioni_sale for insert to authenticated with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi']::text[]));
create policy prenotazioni_sale_staff_update on public.prenotazioni_sale for update to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi']::text[])) with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi']::text[]));
create policy prenotazioni_sale_staff_delete on public.prenotazioni_sale for delete to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','Direttore Centro Congressi']::text[]));

drop policy if exists camere_giorno_staff_insert on public.camere_giorno;
drop policy if exists camere_giorno_staff_update on public.camere_giorno;
drop policy if exists camere_giorno_staff_delete on public.camere_giorno;
create policy camere_giorno_staff_insert on public.camere_giorno for insert to authenticated with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','manutentore']::text[]));
create policy camere_giorno_staff_update on public.camere_giorno for update to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','manutentore']::text[])) with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','manutentore']::text[]));
create policy camere_giorno_staff_delete on public.camere_giorno for delete to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione']::text[]));

drop policy if exists camere_lavoro_staff_insert on public.camere_lavoro;
drop policy if exists camere_lavoro_staff_update on public.camere_lavoro;
drop policy if exists camere_lavoro_staff_delete on public.camere_lavoro;
create policy camere_lavoro_staff_insert on public.camere_lavoro for insert to authenticated with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','manutentore']::text[]));
create policy camere_lavoro_staff_update on public.camere_lavoro for update to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','manutentore']::text[])) with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','manutentore']::text[]));
create policy camere_lavoro_staff_delete on public.camere_lavoro for delete to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione']::text[]));

drop policy if exists import_camere_staff_insert on public.import_camere;
drop policy if exists import_camere_staff_update on public.import_camere;
drop policy if exists import_camere_staff_delete on public.import_camere;
create policy import_camere_staff_insert on public.import_camere for insert to authenticated with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','manutentore']::text[]));
create policy import_camere_staff_update on public.import_camere for update to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','manutentore']::text[])) with check (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione','manutentore']::text[]));
create policy import_camere_staff_delete on public.import_camere for delete to authenticated using (has_hotel_role(hotel_id, array['admin','Responsabile','Direzione']::text[]));
