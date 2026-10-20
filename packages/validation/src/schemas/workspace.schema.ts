// ============================================
// packages/validation/src/schemas/workspace.schema.ts
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  isoDateSchema,
  currencyCodeSchema,
} from './common.schema'

// ============================================
// Workspace (فضای کاری)
// ============================================

export const workspaceSchema = z.object({
  id: uuidSchema.optional(),
  name: nonEmptyStringSchema,
  slug: nonEmptyStringSchema,
  description: optionalStringSchema,
  // Both accept an http(s) URL or an inline `data:` URI — that is how the
  // settings page uploads an image. `.url()` is applied to neither: Zod's
  // `.url()` happens to accept data URIs today, but relying on that for one
  // field and not the other was accidental, not a decision. Length is what
  // actually needs bounding here.
  logoUrl: z.string().max(10_000_000).optional().nullable(),
  stampUrl: z.string().max(10_000_000).optional().nullable(),
  signatureUrl: z.string().max(10_000_000).optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Workspace = z.infer<typeof workspaceSchema>

/**
 * The body of a workspace creation.
 *
 * ⚠️ `slug` IS OPTIONAL HERE, AND THAT IS NOT A LOOSENING.
 *
 * The service has always generated the slug from the name when the body does
 * not carry one (`data.slug || data.name.toLowerCase()…`), so requiring it in
 * the schema only refused a request the service was willing to serve. The
 * offline first run sends a business name in the owner's own script — a name
 * is not a slug, and a Latin slug cannot be made out of it.
 *
 * `baseCurrency` and `timeZone` are the device's own answers, asked once at
 * creation: the books currency and the business time zone («today» is
 * midnight in the BUSINESS's zone, not the device's). They are optional
 * because the cloud sets its books currency through its own endpoint; the
 * LOCAL engine refuses a creation without one — a currency is never assumed.
 */
export const createWorkspaceSchema = workspaceSchema
  .omit({ id: true, createdAt: true, updatedAt: true, slug: true })
  .extend({
    slug: nonEmptyStringSchema.optional(),
    /** The books currency, as an ISO 4217 code the product knows. */
    baseCurrency: currencyCodeSchema.optional(),
    /** IANA time zone of the business, e.g. `Asia/Kabul`. */
    timeZone: z.string().trim().min(1).max(64).optional(),
  })

export type CreateWorkspace = z.infer<typeof createWorkspaceSchema>

export const updateWorkspaceSchema = workspaceSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateWorkspace = z.infer<typeof updateWorkspaceSchema>

// ============================================
// Workspace Member (عضو فضای کاری)
// ============================================

export const workspaceMemberSchema = z.object({
  id: uuidSchema.optional(),
  workspaceId: uuidSchema,
  userId: uuidSchema,
  role: z.enum(['owner', 'admin', 'member', 'viewer']).default('member'),
  joinedAt: isoDateSchema.optional(),
  createdAt: isoDateSchema.optional(),
})

export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>

export const createWorkspaceMemberSchema = workspaceMemberSchema.omit({
  id: true,
  joinedAt: true,
  createdAt: true,
})

export type CreateWorkspaceMember = z.infer<typeof createWorkspaceMemberSchema>

export const updateMemberRoleSchema = z.object({
  memberId: uuidSchema,
  role: z.enum(['admin', 'member', 'viewer']),
})

export type UpdateMemberRole = z.infer<typeof updateMemberRoleSchema>

// ============================================
// Workspace Invite (دعوت‌نامه)
// ============================================

export const workspaceInviteSchema = z.object({
  id: uuidSchema.optional(),
  workspaceId: uuidSchema,
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  invitedBy: uuidSchema,
  token: z.string(),
  status: z.enum(['pending', 'accepted', 'rejected', 'expired']).default('pending'),
  expiresAt: isoDateSchema,
  createdAt: isoDateSchema.optional(),
})

export type WorkspaceInvite = z.infer<typeof workspaceInviteSchema>

export const createInviteSchema = z.object({
  workspaceId: uuidSchema,
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
})

export type CreateInvite = z.infer<typeof createInviteSchema>

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
})

export type AcceptInvite = z.infer<typeof acceptInviteSchema>

// ============================================
// Direct Member Creation (دسترسی مستقیم کارمند به سایت)
// عضو با ایمیل/پسورد مستقیم زیر workspace مالک ساخته می‌شود،
// بدون فرآیند دعوت/پذیرش ایمیلی — چون خودِ مالک پسورد را وارد می‌کند.
// ============================================

/**
 * Adding a colleague directly — no invite round-trip.
 *
 * `hasAccess` decides whether an auth account is created at all. Someone on the
 * payroll who never opens the software needs a record, not a login, and
 * requiring credentials for them was the source of most invite failures. When
 * it is false, email and password are not read.
 */
/**
 * Request body. `workspaceId` is not part of it — the workspace comes from the
 * URL. Kept separate because the cross-field rules below are `.refine()`s, and
 * a refined schema can no longer be `.omit()`ed.
 */
export const createMemberDirectBodySchema = z
  .object({
    fullName: nonEmptyStringSchema,
    jobTitle: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(32).optional(),
    role: z.enum(['admin', 'member', 'viewer']).default('member'),
    hasAccess: z.boolean().default(true),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
  })
  .refine((value) => !value.hasAccess || Boolean(value.email), {
    message: 'An email is required when the member can sign in',
    path: ['email'],
  })
  .refine((value) => !value.hasAccess || Boolean(value.password), {
    message: 'A password is required when the member can sign in',
    path: ['password'],
  })

export type CreateMemberDirectBody = z.infer<typeof createMemberDirectBodySchema>

/** What the service receives: the validated body plus the workspace from the URL. */
export type CreateMemberDirect = CreateMemberDirectBody & { workspaceId: string }

/** Suspending keeps the row and its history; deleting removes the account. */
export const setMemberSuspensionSchema = z.object({
  memberId: uuidSchema,
  suspended: z.boolean(),
})

export type SetMemberSuspension = z.infer<typeof setMemberSuspensionSchema>

/** Hard ceiling on colleagues per workspace, enforced server-side. */
export const MAX_WORKSPACE_MEMBERS = 10
