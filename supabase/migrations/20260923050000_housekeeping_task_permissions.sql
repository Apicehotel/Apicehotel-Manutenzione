-- Governante / Capo Governante operational navigation
-- Task is alerts + reminders only. Chat and RandAI remain unavailable.

insert into public.role_permissions (role,module,action,allowed,updated_at)
select role, module, 'view', true, now()
from (values ('Governante'),('Capo Governante')) as r(role)
cross join (values ('urgent'),('reminders')) as m(module)
on conflict (role,module,action)
do update set allowed = excluded.allowed, updated_at = excluded.updated_at;

-- Explicitly deny intervention/planning visibility for these roles.
insert into public.role_permissions (role,module,action,allowed,updated_at)
select role, module, 'view', false, now()
from (values ('Governante'),('Capo Governante')) as r(role)
cross join (values ('interventions'),('planning_work'),('planning_sale')) as m(module)
on conflict (role,module,action)
do update set allowed = excluded.allowed, updated_at = excluded.updated_at;
