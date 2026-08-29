update public.randai_equipment
set
  location = 'Tetto Wine — accesso da ascensore centrale, 4° Wine, scale adiacenti',
  description = 'Prima di salire sul tetto controllare il display dell’impianto nell’ufficio a sinistra nella Hall Wine. Verificare le temperature di ingresso e uscita. In caso di dubbi scattare una foto del display e inviarla nel gruppo. Se serve raggiungere il motore: ascensore centrale fino al 4° Wine, salire le scale adiacenti, uscire sul tetto e comunicare eventuali errori o anomalie riscontrate.',
  updated_at = now()
where id = 'hotelgio-wine-ac-rooftop-group' and hotel_id = 'hotelgio';

insert into public.randai_procedures (
  id,
  hotel_id,
  title,
  category,
  area,
  symptom,
  summary,
  keywords,
  steps,
  caution,
  source_label,
  status,
  version,
  approved_at,
  created_at,
  updated_at
) values (
  'hotelgio-wine-hvac-check-access',
  'hotelgio',
  'Wine - controllo display e accesso al motore climatizzazione',
  'climatizzazione',
  'Wine',
  'Controllo climatizzazione Wine, temperature ingresso/uscita e accesso al motore',
  'Prima di salire sul tetto controllare il display nell’ufficio a sinistra nella Hall Wine e verificare le temperature di ingresso e uscita. Se i valori non sono chiari, inviare una foto del display nel gruppo. Solo se necessario procedere al motore sul tetto.',
  array['wine','climatizzazione','condizionata','motore','display','temperatura','temperature','ingresso','uscita','tetto','hall wine','4 wine'],
  '["Andare nell’ufficio a sinistra nella Hall Wine.","Controllare il display dell’impianto e verificare le temperature di ingresso e uscita.","Se ci sono dubbi sui valori o sulla lettura, scattare una foto del display e inviarla nel gruppo prima di procedere.","Se è necessario raggiungere il motore, prendere l’ascensore centrale fino al 4° Wine.","Salire le scale adiacenti all’ascensore e uscire sul tetto.","Controllare il motore dell’aria condizionata Wine e comunicare eventuali errori o anomalie riscontrate."]'::jsonb,
  'Non salire sul tetto come primo controllo: verificare prima il display e le temperature di ingresso e uscita nell’ufficio della Hall Wine.',
  'Procedura interna confermata',
  'approved',
  1,
  now(),
  now(),
  now()
)
on conflict (id) do update set
  title = excluded.title,
  category = excluded.category,
  area = excluded.area,
  symptom = excluded.symptom,
  summary = excluded.summary,
  keywords = excluded.keywords,
  steps = excluded.steps,
  caution = excluded.caution,
  source_label = excluded.source_label,
  status = excluded.status,
  version = greatest(public.randai_procedures.version, excluded.version),
  approved_at = now(),
  updated_at = now();
