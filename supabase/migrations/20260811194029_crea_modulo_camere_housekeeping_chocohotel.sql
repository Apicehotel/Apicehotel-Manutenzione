create table if not exists camere_giorno (
  camera text primary key,
  struttura text not null,
  piano int not null,
  tipologia text,
  stato_slope text not null default 'libera',
  letti text,
  note text,
  arrivo text,
  partenza text,
  import_id uuid
);

create table if not exists camere_lavoro (
  camera text primary key references camere_giorno(camera) on delete cascade,
  stato text not null default 'dafare',
  da_chi text,
  aggiornato_il timestamptz not null default now()
);

create table if not exists import_camere (
  id uuid primary key default gen_random_uuid(),
  caricato_da text,
  caricato_il timestamptz not null default now(),
  n_camere int,
  n_b2b int
);

alter table camere_giorno enable row level security;
alter table camere_lavoro enable row level security;
alter table import_camere enable row level security;

create policy "camere_giorno_all" on camere_giorno for all using (true) with check (true);
create policy "camere_lavoro_all" on camere_lavoro for all using (true) with check (true);
create policy "import_camere_all" on import_camere for all using (true) with check (true);

alter publication supabase_realtime add table camere_giorno;
alter publication supabase_realtime add table camere_lavoro;

-- RPC identica a Hotel Gio': riscrive camere_giorno per intero e fa
-- ripartire camere_lavoro (libera->fatto, resto->dafare), poi aggiorna lo
-- Stato camera delle segnalazioni ancora aperte in base al nuovo file.
create or replace function carica_camere_giorno(p_caricato_da text, p_camere jsonb)
returns uuid
language plpgsql
security definer
as $function$
declare
  v_import_id uuid;
  v_n         int;
  v_b2b       int;
  r           jsonb;
begin
  v_n := jsonb_array_length(p_camere);
  select count(*) into v_b2b
    from jsonb_array_elements(p_camere) e
    where e->>'stato_slope' = 'b2b';

  insert into import_camere (caricato_da, n_camere, n_b2b)
  values (p_caricato_da, v_n, v_b2b)
  returning id into v_import_id;

  delete from camere_giorno where true;
  for r in select * from jsonb_array_elements(p_camere)
  loop
    insert into camere_giorno
      (camera, struttura, piano, tipologia, stato_slope, letti, note, arrivo, partenza, import_id)
    values (
      r->>'camera',
      r->>'struttura',
      (r->>'piano')::int,
      r->>'tipologia',
      coalesce(r->>'stato_slope','libera'),
      nullif(r->>'letti',''),
      nullif(r->>'note',''),
      nullif(r->>'arrivo',''),
      nullif(r->>'partenza',''),
      v_import_id
    );
  end loop;

  delete from camere_lavoro where true;
  insert into camere_lavoro (camera, stato)
  select camera,
         case when stato_slope = 'libera' then 'fatto' else 'dafare' end
  from camere_giorno;

  update segnalazioni s
  set stato_camera = case cg.stato_slope
        when 'libera'   then 'libera'
        when 'arrivo'   then 'arrivo'
        when 'partenza' then 'fermata_cliente'
        when 'fermata'  then 'fermata_cliente'
        when 'b2b'      then 'fermata_cliente'
        else s.stato_camera
      end
  from camere_giorno cg
  where cg.camera = s.camera
    and s.stato in ('todo', 'waiting', 'tecnico');

  return v_import_id;
end;
$function$;
