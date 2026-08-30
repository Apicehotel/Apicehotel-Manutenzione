revoke execute on function public.randai_claim_task(text,text,integer) from authenticated;
revoke execute on function public.randai_renew_task_lease(text,uuid,integer) from authenticated;
revoke execute on function public.randai_release_task_lease(text,uuid) from authenticated;

grant execute on function public.randai_claim_task(text,text,integer) to service_role;
grant execute on function public.randai_renew_task_lease(text,uuid,integer) to service_role;
grant execute on function public.randai_release_task_lease(text,uuid) to service_role;
