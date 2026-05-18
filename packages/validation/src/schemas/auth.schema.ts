// ============================================
// Auth Schemas
// ============================================

import { z } from 'zod'
import { emailSchema, nonEmptyStringSchema } from './common.schema'

// ============================================
// Login
// ============================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'validation.minLength'),
})

export type LoginInput = z.infer<typeof loginSchema>

// ============================================
// Sign Up
// ============================================

export const signUpSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, 'validation.minLength')
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
// Reset Password
// ============================================

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'validation.minLength'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
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
  businessName: z.string().max(200).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>