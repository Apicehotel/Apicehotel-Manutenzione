-- Rifornimenti: aggiornamenti event-driven senza polling.
alter publication supabase_realtime add table public.supply_products;
alter publication supabase_realtime add table public.supply_requests;
alter publication supabase_realtime add table public.supply_request_items;
