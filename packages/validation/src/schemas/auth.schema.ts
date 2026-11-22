// ============================================
// Auth Schemas
// ============================================

import { z } from 'zod'
import { emailSchema, nonEmptyStringSchema } from './common.schema'
import { canonicalIndustryTypes, MAX_INDUSTRY_SELECTION } from './industry-profiles'

// ============================================
// Login
// ============================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'signup.errors.passwordMin'),
})

export type LoginInput = z.infer<typeof loginSchema>

// ============================================
// Sign Up
// ============================================

export const signUpSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, 'signup.errors.passwordMin')
    .max(128, 'validation.maxLength')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    ),
  fullName: nonEmptyStringSchema,
  businessName: z.string().max(200).optional(),
})

export type SignUpInput = z.infer<typeof signUpSchema>

// ============================================
// Forgot Password
// ============================================

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

// ============================================
// Reset Password — confirmPassword optional
// ============================================

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'signup.errors.passwordMin'),
  confirmPassword: z.string().optional(),
})

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

// ============================================
// PIN Code
// ============================================

export const pinCodeSchema = z
  .string()
  .length(4, 'PIN must be 4 digits')
  .regex(/^\d{4}$/, 'PIN must contain only digits')

export type PinCodeInput = z.infer<typeof pinCodeSchema>

// ============================================
// Update Profile
// ============================================

export const updateProfileSchema = z.object({
  fullName: nonEmptyStringSchema.optional(),
  /**
   * `null` means "clear it", and is accepted rather than rejected.
   *
   * A PATCH form that has never had a business name sends `null` for the field,
   * and `z.string()` refused it — so every profile edit by a user without a
   * business name came back 400 "ذخیره نشد". Normalized to an empty string so
   * the write path stays a single type.
   */
  businessName: z
    .union([z.string().max(200), z.null()])
    .transform((value) => value ?? '')
    .optional(),
  /**
   * Optional must wrap the union, not sit inside it.
   *
   * `z.string().url().optional().or(z.literal(''))` makes the outermost type a
   * ZodUnion, so `zodToJsonSchema` emitted `avatarUrl` as REQUIRED and Fastify
   * rejected every profile edit that did not send an avatar with a 400 —
   * which was every edit made from the settings form.
   */
  avatarUrl: z
    .union([z.string().url(), z.literal(''), z.null()])
    .transform((value) => value ?? '')
    .optional(),

  // ─── Onboarding, stored on the account rather than the browser ───
  // Clearing site data used to replay the wizard to someone who had already
  // finished it. See docs/onboarding-server-state-migration.sql.
  onboardingCompleted: z.boolean().optional(),
  // ⚠️ THE ACCOUNT WRITE APPLIES THE SAME CANONICAL RULE AS THE WORKSPACE WRITE
  // (forensic audit F-007/F-018/F-097). Raw strings («foo», «SERVICE», duplicates)
  // used to land in `profiles.business_types` here while `setWorkspaceProfile`
  // refused them — the two copies of the industry then disagreed. Unknown and
  // legacy values are refused with the exact list; duplicates/casing/order are
  // normalised by the ONE canonicaliser. An empty array still clears the field.
  businessTypes: z
    .array(z.string().max(64))
    .max(MAX_INDUSTRY_SELECTION)
    .transform((values, ctx) => {
      const canonical = canonicalIndustryTypes(values)
      if (canonical.unknown.length > 0 || canonical.legacy.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `BUSINESS_TYPE_UNKNOWN: ${[...canonical.unknown, ...canonical.legacy].join(', ')}`,
        })
        return z.NEVER
      }
      return [...canonical.known]
    })
    .optional(),
  // `solo` («کار انفرادی، ۱ نفر») is the first card the onboarding screen offers; refusing it
  // left an owner who works alone stuck on «ورود به حسابچه» (400 on every press). Accepted on
  // the owner's instruction (15 Nov 2026); the headcount mapping of the other three stays
  // open in docs/architecture/OPEN-DECISIONS.md D-01. Guard: onboarding-store-size.test.ts
  storeSize: z.enum(['solo', 'small', 'medium', 'large']).optional(),
  businessNote: z.string().max(2000).optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
