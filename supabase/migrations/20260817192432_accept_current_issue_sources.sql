alter table public.maintenance_issues drop constraint if exists maintenance_issues_source_check;
alter table public.maintenance_issues add constraint maintenance_issues_source_check check (source = any (array['app','whatsapp','system','App','WhatsApp','Sistema','Avviso urgente','Intervento pianificato']::text[]));
