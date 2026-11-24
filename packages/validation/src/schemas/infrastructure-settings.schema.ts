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

/**
 * Pure generator that produces an Nginx runtime override block from the active
 * infrastructure settings so operators and scripts share one canonical rendering.
 */
export function buildNginxConfigDirectives(settings: InfrastructureSettings): string {
  const safeHeader =
    settings.cacheBypassHeader.replace(/[^A-Za-z0-9_-]/g, '') || 'X-Hisabche-Bypass-Cache'
  const lines: string[] = [
    '# Hisabche Nginx Runtime Control Directives (Generated)',
    `# Edge Proxy Mode: ${settings.nginxProxyEnabled ? 'ENABLED' : 'BYPASSED_DIRECT'}`,
    `set $hisabche_proxy_mode "${settings.nginxProxyEnabled ? 'nginx' : 'direct'}";`,
    settings.rateLimitingEnabled
      ? `limit_req zone=api_limit burst=${settings.rateLimitBurst} nodelay; # Target ${settings.rateLimitRps} req/s`
      : '# Edge rate limiting DISABLED by Admin Control Plane',
    `set $hisabche_cache_bypass "${settings.cacheBypassEnabled ? '1' : '0'}"; # Header: ${safeHeader}`,
    settings.wsCompressionEnabled
      ? '# WebSocket compression enabled'
      : '# WebSocket compression disabled (gzip off for upgrade)',
    settings.upstreamHealthCheck
      ? '# Upstream health probes enabled (max_fails=3 fail_timeout=10s)'
      : '# Upstream health probes disabled',
    settings.hstsEnabled
      ? `add_header Strict-Transport-Security "max-age=${settings.hstsMaxAge}; includeSubDomains; preload" always;`
      : '# HSTS header disabled',
    settings.maintenanceMode
      ? `set $hisabche_maintenance 1; # Notice: ${settings.maintenanceNotice || 'Scheduled maintenance'}`
      : 'set $hisabche_maintenance 0;',
  ]
  return lines.join('\n')
}
