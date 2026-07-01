// ============================================
// packages/validation/src/schemas/ai.schema.ts
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  isoDateSchema,
} from './common.schema'

// ============================================
// AI Query
// ============================================

export const aiQuerySchema = z.object({
  question: nonEmptyStringSchema,
  context: z.enum(['general', 'sales', 'inventory', 'accounting', 'hr', 'projects']).default('general'),
  language: z.enum(['fa', 'en', 'ps']).default('fa'),
})

export type AIQuery = z.infer<typeof aiQuerySchema>

// ============================================
// AI Response
// ============================================

export const aiResponseSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.object({
    type: z.string(),
    description: z.string(),
  })),
  suggestions: z.array(nonEmptyStringSchema),
  data: z.record(z.unknown()).optional(),
})

export type AIResponse = z.infer<typeof aiResponseSchema>

// ============================================
// AI Insight
// ============================================

export const aiInsightSchema = z.object({
  type: z.enum(['warning', 'info', 'success', 'tip']),
  title: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  action: optionalStringSchema,
  actionLabel: optionalStringSchema,
  metric: z.number().optional(),
  metricLabel: optionalStringSchema,
})

export type AIInsight = z.infer<typeof aiInsightSchema>

// ============================================
// AI Chat History
// ============================================

export const aiChatMessageSchema = z.object({
  id: uuidSchema.optional(),
  userId: uuidSchema,
  role: z.enum(['user', 'assistant']),
  content: nonEmptyStringSchema,
  createdAt: isoDateSchema.optional(),
})

export type AIChatMessage = z.infer<typeof aiChatMessageSchema>