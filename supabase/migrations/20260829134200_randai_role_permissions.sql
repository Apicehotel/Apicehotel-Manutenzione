insert into public.role_permissions (role,module,action,allowed)
select 'RandAI', module, action, allowed
from public.role_permissions
where role='admin'
on conflict (role,module,action) do update set allowed=excluded.allowed, updated_at=now();
