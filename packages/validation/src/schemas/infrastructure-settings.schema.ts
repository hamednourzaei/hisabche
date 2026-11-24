import { z } from 'zod'

export const infrastructureSettingsSchema = z.object({
  nginxProxyEnabled: z.boolean().default(true),
  rateLimitingEnabled: z.boolean().default(true),
  rateLimitRps: z.number().int().min(1).max(10000).default(100),
  rateLimitBurst: z.number().int().min(1).max(1000).default(50),
  cacheBypassEnabled: z.boolean().default(false),
  cacheBypassHeader: z.string().min(1).max(64).default('X-Hisabche-Bypass-Cache'),
  maintenanceMode: z.boolean().default(false),
  maintenanceNotice: z.string().max(280).default(''),
  wsCompressionEnabled: z.boolean().default(true),
  upstreamHealthCheck: z.boolean().default(true),
  hstsEnabled: z.boolean().default(true),
  hstsMaxAge: z.number().int().min(0).max(63072000).default(31536000),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
})

export type InfrastructureSettings = z.infer<typeof infrastructureSettingsSchema>

export const updateInfrastructureSettingsSchema = infrastructureSettingsSchema
  .omit({ updatedAt: true, updatedBy: true })
  .partial()

export type UpdateInfrastructureSettingsInput = z.infer<typeof updateInfrastructureSettingsSchema>

export const DEFAULT_INFRASTRUCTURE_SETTINGS: InfrastructureSettings = {
  nginxProxyEnabled: true,
  rateLimitingEnabled: true,
  rateLimitRps: 100,
  rateLimitBurst: 50,
  cacheBypassEnabled: false,
  cacheBypassHeader: 'X-Hisabche-Bypass-Cache',
  maintenanceMode: false,
  maintenanceNotice: '',
  wsCompressionEnabled: true,
  upstreamHealthCheck: true,
  hstsEnabled: true,
  hstsMaxAge: 31536000,
  updatedAt: '2026-11-24T00:00:00.000Z',
  updatedBy: 'system',
}
