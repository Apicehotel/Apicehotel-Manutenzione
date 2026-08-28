insert into public.role_permissions (role,module,action,allowed,updated_at)
select 'admin', m.module, a.action, true, now()
from (values ('sensors'),('usage'),('diagnostics')) as m(module)
cross join (values ('view'),('create'),('edit'),('assign'),('take_charge'),('complete'),('delete'),('manage')) as a(action)
on conflict (role,module,action)
do update set allowed = excluded.allowed, updated_at = excluded.updated_at;
