-- Harden the Block 13 runtime configuration RPC after database verification.
-- PostgreSQL/Supabase may retain an explicit anon EXECUTE ACL from prior/default grants;
-- fail closed and make the intended caller set explicit.

revoke execute on function public.randai_set_runtime_config(text,text,text,jsonb,integer) from public;
revoke execute on function public.randai_set_runtime_config(text,text,text,jsonb,integer) from anon;
grant execute on function public.randai_set_runtime_config(text,text,text,jsonb,integer) to authenticated;
grant execute on function public.randai_set_runtime_config(text,text,text,jsonb,integer) to service_role;
