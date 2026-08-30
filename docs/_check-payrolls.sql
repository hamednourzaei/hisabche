-- READ ONLY. Is `payrolls: 0` correct, or is the policy too strict?
--
-- The test user sees 2 of the 7 employees and 0 of the 4 payrolls. If those
-- four payrolls belong to the OTHER five employees, zero is the right answer
-- and the policy is working. If any of them belongs to one of this user's own
-- two employees, the policy is hiding a payroll from the person who owns it —
-- and somebody would find that out on payday.

select
  p.id::text                                as payroll_id,
  coalesce(p.workspace_id::text, '(none)')  as payroll_workspace,
  coalesce(e.workspace_id::text, '(none)')  as employee_workspace,
  coalesce(e.first_name || ' ' || e.last_name, '(no employee)') as employee,
  case
    when p.workspace_id is null              then 'ORPHAN — belongs to no workspace, invisible to everyone'
    when e.id is null                        then 'ORPHAN — its employee no longer exists'
    when p.workspace_id <> e.workspace_id    then 'MISMATCH — payroll and employee are in different workspaces'
    when p.workspace_id = '370b0f76-ad7e-4973-bbd4-cfb785dd0914'::uuid
                                             then 'PROBLEM — this is the test user workspace and they could not see it'
    else 'OK — belongs to a different workspace, correctly hidden'
  end as verdict
from payrolls p
left join employees e on e.id = p.employee_id
order by verdict, payroll_id;
