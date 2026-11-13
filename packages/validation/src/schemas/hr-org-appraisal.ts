import { z } from 'zod'

export const addEmployeeDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  kind: z.string().min(1).max(60).default('document'),
  // A link the browser opens: https only (no javascript:, data: or file:).
  file_url: z
    .string()
    .url()
    .max(2000)
    .refine((value) => value.startsWith('https://'), { message: 'EMPLOYEE_DOCUMENT_URL_HTTPS' }),
})

export const createAppraisalSchema = z.object({
  period: z.string().min(2).max(40),
  criteria: z
    .array(
      z.object({
        label: z.string().min(1).max(160),
        observation: z.string().max(500),
      }),
    )
    .min(1),
  notes: z.string().max(1000).optional(),
})

export function detectOrgCycle(
  reportsToMap: ReadonlyMap<string, string | null>,
  employeeId: string,
  candidateReportsTo: string | null,
): boolean {
  if (!candidateReportsTo) return false
  if (candidateReportsTo === employeeId) return true
  const visited = new Set<string>([employeeId])
  let cur: string | null = candidateReportsTo
  while (cur) {
    if (visited.has(cur)) return true
    visited.add(cur)
    cur = reportsToMap.get(cur) ?? null
  }
  return false
}

export function collectSubordinateIds(
  employees: ReadonlyArray<{ id: string; reports_to: string | null }>,
  managerEmployeeId: string,
): Set<string> {
  const childrenByMgr = new Map<string, string[]>()
  for (const e of employees) {
    if (!e.reports_to) continue
    const list = childrenByMgr.get(e.reports_to) ?? []
    list.push(e.id)
    childrenByMgr.set(e.reports_to, list)
  }
  const result = new Set<string>()
  const queue = [...(childrenByMgr.get(managerEmployeeId) ?? [])]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (result.has(id)) continue
    result.add(id)
    for (const child of childrenByMgr.get(id) ?? []) queue.push(child)
  }
  return result
}
