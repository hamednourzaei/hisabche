// G1 — the employee detail screen, which desktop never routed.
//
// Web had `/human-resources/[id]`; desktop had no equivalent, so `onView` on
// the employee list navigated to a path the hash router answered with the
// dashboard. Now that the canonical path is `/team-and-payroll/:id` on both,
// the missing half is added here rather than leaving one platform behind.
import { EmployeeDetailContainer } from '@hisabche/ui/screens'
import { useParams } from 'react-router-dom'

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <EmployeeDetailContainer id={id ?? ''} />
}
