-- Housekeeping v2: il consuntivo ufficiale deriva dal trigger su camere_lavoro.
-- Le RPC manuali restano disponibili solo al service role per ridurre la superficie esposta.
revoke execute on function public.upsert_housekeeping_completion(text,text,text,text,integer,text) from authenticated;
revoke execute on function public.clear_housekeeping_completion(text,text) from authenticated;
grant execute on function public.upsert_housekeeping_completion(text,text,text,text,integer,text) to service_role;
grant execute on function public.clear_housekeeping_completion(text,text) to service_role;
