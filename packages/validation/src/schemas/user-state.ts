// ============================================
// packages/validation/src/schemas/user-state.ts
//
// What a PERSON keeps on the server (user-state-01, 9 Nov 2026):
//   • invoice drafts — the builder's own state, one row per saved draft;
//   • preferences   — the theme today.
// The backend is only a step: these used to live in one browser's storage.
// ============================================

import { z } from 'zod'

/** The four documents the invoice builder makes. */
export const INVOICE_DRAFT_KINDS = ['sale', 'purchase', 'pre_sale', 'pre_purchase'] as const
export type InvoiceDraftKind = (typeof INVOICE_DRAFT_KINDS)[number]

/** A draft is the builder's state, not a document: this bounds it, nothing more. */
export const MAX_INVOICE_DRAFT_BYTES = 200_000
/** Drafts one person keeps in one workspace; the oldest must go first. */
export const MAX_INVOICE_DRAFTS = 50

export const invoiceDraftSaveSchema = z.object({
  /** Present when the builder is continuing a draft it saved before. */
  id: z.string().uuid().optional(),
  kind: z.enum(INVOICE_DRAFT_KINDS),
  title: z.string().trim().max(200).default(''),
  payload: z.record(z.string(), z.unknown()),
})
export type InvoiceDraftSaveInput = z.infer<typeof invoiceDraftSaveSchema>

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

export const userPreferencesSchema = z.object({
  theme: z.enum(THEME_PREFERENCES),
})
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>
