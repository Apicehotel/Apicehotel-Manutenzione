-- RandCore Point 2: publish every client-visible operational table that has
-- an existing postgres_changes subscriber. The client subscriptions remain
-- domain-owned; this migration fixes the database side of the contract.

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'segnalazioni',
    'interventi',
    'richieste_urgenti',
    'planning_lavori',
    'planning_lavori_giorni',
    'prenotazioni_sale',
    'promemoria',
    'promemoria_invio',
    'notification_reads',
    'camere_giorno',
    'camere_lavoro',
    'housekeeping_completions',
    'sensori_temperatura',
    'feedback',
    'supply_products',
    'supply_requests',
    'supply_request_items',
    'inventory_items',
    'inventory_movements',
    'inventory_categories',
    'inventory_locations',
    'sale_rooms_config',
    'whatsapp_channel_settings',
    'whatsapp_inbound_messages',
    'external_technicians',
    'external_technician_competencies',
    'technician_dispatch_requests',
    'technician_intervention_events'
  ] loop
    if to_regclass('public.' || v_table) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = v_table
       ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;

comment on publication supabase_realtime is
  'RandApp client-visible operational tables; service-only event and webhook tables are intentionally excluded.';
