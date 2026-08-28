-- Punto 10: conserva correttamente gli import precedenti alla nuova cronologia.

update public.import_camere
set work_date = (caricato_il at time zone 'Europe/Rome')::date
where payload_hash is null;

update public.camere_lavoro cl
set work_date = ic.work_date
from public.camere_giorno cg
join public.import_camere ic on ic.id = cg.import_id
where cg.hotel_id = cl.hotel_id
  and cg.camera = cl.camera
  and cl.work_date is distinct from ic.work_date;

insert into public.housekeeping_daily_rooms(
  hotel_id,work_date,camera,struttura,piano,tipologia,stato_slope,letti,arrivo,partenza,import_id,aggiornato_il
)
select
  cg.hotel_id,ic.work_date,cg.camera,cg.struttura,cg.piano,cg.tipologia,cg.stato_slope,
  cg.letti,cg.arrivo,cg.partenza,cg.import_id,cg.aggiornato_il
from public.camere_giorno cg
join public.import_camere ic on ic.id = cg.import_id
on conflict (hotel_id,work_date,camera) do nothing;

insert into public.housekeeping_import_rooms(
  import_id,hotel_id,work_date,camera,struttura,piano,tipologia,stato_slope,letti,arrivo,partenza,created_at
)
select
  cg.import_id,cg.hotel_id,ic.work_date,cg.camera,cg.struttura,cg.piano,cg.tipologia,cg.stato_slope,
  cg.letti,cg.arrivo,cg.partenza,coalesce(cg.aggiornato_il,ic.caricato_il)
from public.camere_giorno cg
join public.import_camere ic on ic.id = cg.import_id
where cg.import_id is not null
on conflict (import_id,camera) do nothing;
