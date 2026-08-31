-- Point 3 security follow-up: remove anonymous/public execution from SECURITY DEFINER RandAI functions.
-- The trigger function is internal-only. The promotion RPC remains available to authenticated users
-- and retains its own hotel-management permission check.

revoke execute on function public.randai_capture_verified_issue_learning() from public;
revoke execute on function public.randai_capture_verified_issue_learning() from anon;
revoke execute on function public.randai_capture_verified_issue_learning() from authenticated;

grant execute on function public.randai_capture_verified_issue_learning() to service_role;

revoke execute on function public.randai_promote_learning_candidate(text) from public;
revoke execute on function public.randai_promote_learning_candidate(text) from anon;
grant execute on function public.randai_promote_learning_candidate(text) to authenticated;
grant execute on function public.randai_promote_learning_candidate(text) to service_role;
