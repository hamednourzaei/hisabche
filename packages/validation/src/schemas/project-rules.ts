// ============================================
// packages/validation/src/schemas/project-rules.ts
//
// What a project's progress is. One rule for the server's ProjectService and the
// device, so a project reads the same percentage in both.
// ============================================

/**
 * The share of tasks that are done, as a whole percent. A project with no task
 * has 0 — «nothing planned», not «finished».
 *
 * ⚠️ Recomputed whenever a task is ADDED, changed or removed: adding a task
 * changes the denominator.
 */
export function projectProgress(taskStatuses: readonly string[]): number {
  if (taskStatuses.length === 0) return 0
  const done = taskStatuses.filter((status) => status === 'done').length
  return Math.round((done / taskStatuses.length) * 100)
}
