// ============================================
// packages/validation/src/schemas/note-rules.ts
//
// Internal notes (#103) — what may carry a note, and what a valid note is. The
// server's NotesService and the device both apply it.
// ============================================

export interface NoteDraft {
  entityType: string
  entityId: string
  body: string
}

/**
 * ⚠️ WHAT MAY CARRY A NOTE, and what may not.
 *
 * A note on a customer is a sales record. A note on a JOURNAL ENTRY is a claim
 * about the books that is not one — and an attachment is storage the shop has to
 * be able to export and delete. So the list is closed, for the same reason
 * `NEVER_EXTENSIBLE` is.
 */
export const NOTABLE_ENTITIES: readonly string[] = [
  'customer',
  'supplier',
  'product',
  'project',
  'task',
  'employee',
]

export type NoteProblem = 'NOT_NOTABLE' | 'EMPTY_BODY' | 'BODY_TOO_LONG'

/** A note longer than this is a document, and documents have their own place. */
export const MAX_NOTE_LENGTH = 4_000

export function validateNote(draft: NoteDraft): NoteProblem[] {
  const problems: NoteProblem[] = []

  if (!(NOTABLE_ENTITIES as readonly string[]).includes(draft.entityType)) {
    problems.push('NOT_NOTABLE')
  }

  if (draft.body.trim().length === 0) {
    problems.push('EMPTY_BODY')
  } else if (draft.body.length > MAX_NOTE_LENGTH) {
    problems.push('BODY_TOO_LONG')
  }

  return problems
}
