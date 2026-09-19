'use client'

// ============================================
// packages/ui/src/hooks/use-server-field-errors.ts
//
// «هر فیلد در هر جای پروژه مشکل داشت، کاربر را ببر به اون بخش فیکسش بکنه».
//
// A refused save gets three things, not one:
//   1. the message on the field that caused it,
//   2. the page scrolled to that field with the cursor in it,
//   3. a whole-form sentence for the part that belongs to no field.
//
// A form opts in by giving each input a `name` that matches the API's field
// name — which is also what the browser's own autofill and a plain <form>
// submit already use, so nothing extra is invented.
// ============================================

import { useCallback, useState } from 'react'
import { apiErrorFields, apiErrorMessage, type ApiFieldError } from '@hisabche/api'

export interface ServerFieldErrors {
  /** field name → the server's reason, for rendering under that input. */
  fields: Record<string, string>
  /** What to show above the form: set only when no field could be blamed. */
  formError: string | null
  /** Read a rejected request: fills both, and sends the user to the field. */
  report: (error: unknown, fallback: string) => void
  /** Clear before a retry, so a fixed field stops looking broken. */
  reset: () => void
}

/**
 * Put the cursor where the problem is.
 *
 * ⚠️ Looked up inside `container` when one is given: two forms on a page can
 * both have an `email`, and focusing the wrong one moves the user away from
 * the form they are filling in. `name` first, then `id` — a select or a
 * custom control may only carry one of them.
 */
export function focusField(field: string, container?: HTMLElement | null): boolean {
  if (typeof document === 'undefined') return false
  const root: ParentNode = container ?? document
  const escape = (value: string) =>
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(value)
      : value.replace(/["\\]/g, '\\$&')

  const node =
    root.querySelector<HTMLElement>(`[name="${escape(field)}"]`) ??
    root.querySelector<HTMLElement>(`#${escape(field)}`) ??
    // The field may be a path into a list (`lines.0.quantity`); the row's own
    // input is the closest thing to it that exists on the page.
    root.querySelector<HTMLElement>(`[data-field="${escape(field)}"]`)

  if (!node) return false

  node.scrollIntoView({ block: 'center', behavior: 'smooth' })
  // focus() on a non-focusable wrapper is harmless; the scroll already
  // happened, which is the part the user needs.
  node.focus?.({ preventScroll: true })
  return true
}

export function useServerFieldErrors(): ServerFieldErrors {
  const [fields, setFields] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const report = useCallback((error: unknown, fallback: string) => {
    const named: ApiFieldError[] = apiErrorFields(error)

    if (named.length === 0) {
      // Nothing was blamed on a field — a 500, a dropped connection, a rule
      // the server refused. Saying «email is wrong» here would be a lie.
      setFields({})
      setFormError(apiErrorMessage(error, fallback))
      return
    }

    const map: Record<string, string> = {}
    for (const issue of named) {
      // First message per field: the first is the one that stopped it.
      if (!map[issue.field]) map[issue.field] = issue.message
    }
    setFields(map)
    // The field carries its own message, so the banner would repeat it.
    setFormError(null)

    const first = named[0]
    if (first) focusField(first.field)
  }, [])

  const reset = useCallback(() => {
    setFields({})
    setFormError(null)
  }, [])

  return { fields, formError, report, reset }
}
