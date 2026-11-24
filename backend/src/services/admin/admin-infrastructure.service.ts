// ============================================
// backend/src/services/admin/admin-infrastructure.service.ts
//
// Admin Infrastructure & Nginx Control Service.
// Persists edge proxy, rate limiting, cache bypass, HSTS, and emergency
// maintenance settings in the reserved `feature_flags` row
// (`INFRASTRUCTURE_FLAG_KEY`) so stateless backend instances stay synced
// without extra migrations, while keeping an in-process cache for fast hooks.
// ============================================

import { createHmac } from 'node:crypto'
import {
  DEFAULT_INFRASTRUCTURE_SETTINGS,
  buildNginxConfigDirectives,
  infrastructureSettingsSchema,
  type InfrastructureSettings,
  type UpdateInfrastructureSettingsInput,
  updateInfrastructureSettingsSchema,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { INFRASTRUCTURE_FLAG_KEY } from '../../runtime/maintenance-mode'
import { setServiceModeInput } from '../../runtime/service-mode'
import { AdminSecurityService } from './admin-security.service'

const REFRESH_MS = 10_000

function currentEdgeControlMode(): 'fastify_runtime_only' | 'webhook_synced' {
  return process.env.NGINX_RELOAD_WEBHOOK_URL ? 'webhook_synced' : 'fastify_runtime_only'
}

class AdminInfrastructureService {
  private currentSettings: InfrastructureSettings = {
    ...DEFAULT_INFRASTRUCTURE_SETTINGS,
    edgeControlMode: currentEdgeControlMode(),
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  }
  private lastReadMs = 0
  private inflight: Promise<InfrastructureSettings> | null = null
  private refreshEnabled = false
  private reloadFetch: typeof fetch = globalThis.fetch

  setReloadFetchForTest(fn: typeof fetch | null): void {
    this.reloadFetch = fn ?? globalThis.fetch
  }

  enableRefresh(): void {
    this.refreshEnabled = true
  }

  noteRequest(nowMs: number = Date.now()): void {
    if (!this.refreshEnabled || this.inflight || nowMs - this.lastReadMs < REFRESH_MS) return
    void this.loadSettings().catch(() => undefined)
  }

  getSettings(): InfrastructureSettings {
    return { ...this.currentSettings }
  }

  renderNginxDirectives(): string {
    return buildNginxConfigDirectives(this.currentSettings)
  }

  async loadSettings(): Promise<InfrastructureSettings> {
    if (this.inflight) return this.inflight
    this.inflight = (async () => {
      this.lastReadMs = Date.now()
      try {
        const { data, error } = await supabase
          .from('feature_flags')
          .select('is_enabled, description, updated_at')
          .eq('key', INFRASTRUCTURE_FLAG_KEY)
          .maybeSingle()

        if (!error && data && typeof data.description === 'string' && data.description.trim()) {
          const parsedRaw: unknown = JSON.parse(data.description)
          const parsed = infrastructureSettingsSchema.safeParse(parsedRaw)
          if (parsed.success) {
            this.currentSettings = {
              ...parsed.data,
              nginxProxyEnabled:
                typeof data.is_enabled === 'boolean'
                  ? data.is_enabled
                  : parsed.data.nginxProxyEnabled,
              edgeControlMode: currentEdgeControlMode(),
              updatedAt: parsed.data.updatedAt ?? data.updated_at ?? this.currentSettings.updatedAt,
            }
            setServiceModeInput({ maintenance: this.currentSettings.maintenanceMode })
          }
        }
      } catch {
        // Keep last known cached state when running without live DB (dev/unit tests)
      }
      return { ...this.currentSettings }
    })()

    try {
      return await this.inflight
    } finally {
      this.inflight = null
    }
  }

  async updateSettings(
    input: UpdateInfrastructureSettingsInput,
    adminEmail: string,
  ): Promise<InfrastructureSettings> {
    const validated = updateInfrastructureSettingsSchema.parse(input)
    const now = new Date().toISOString()

    const previous = { ...this.currentSettings }

    const next: InfrastructureSettings = { ...this.currentSettings }
    for (const [key, value] of Object.entries(validated)) {
      if (value !== undefined) {
        ;(next as Record<string, unknown>)[key] = value
      }
    }
    next.edgeControlMode = currentEdgeControlMode()
    next.updatedAt = now
    next.updatedBy = adminEmail
    this.currentSettings = next
    this.lastReadMs = Date.now()

    if (validated.maintenanceMode !== undefined) {
      setServiceModeInput({ maintenance: next.maintenanceMode })
    }

    const { error } = await supabase.from('feature_flags').upsert(
      {
        key: INFRASTRUCTURE_FLAG_KEY,
        name: 'Infrastructure & Nginx Control Plane',
        description: JSON.stringify(next),
        is_enabled: next.nginxProxyEnabled,
        rollout_percentage: next.nginxProxyEnabled ? 100 : 0,
        platforms: [],
        countries: [],
        is_beta: false,
        updated_at: now,
      },
      { onConflict: 'key' },
    )
    if (error) {
      this.currentSettings = previous
      setServiceModeInput({ maintenance: previous.maintenanceMode })
      throw new DatabaseError(`Failed to persist infrastructure settings: ${error.message}`)
    }

    // If an external Nginx reload agent/webhook is configured, push directives for
    // `nginx -t && nginx -s reload` and roll back persisted settings on failure.
    const webhookUrl = process.env.NGINX_RELOAD_WEBHOOK_URL
    if (webhookUrl) {
      const directives = buildNginxConfigDirectives(next)
      const bodyJson = JSON.stringify({
        action: 'validate_and_reload',
        directives,
        settings: next,
      })
      const sig = createHmac(
        'sha256',
        process.env.NGINX_RELOAD_WEBHOOK_SECRET || process.env.JWT_SECRET || 'hisabche-infra',
      )
        .update(bodyJson)
        .digest('hex')

      let reloadOk = false
      let reloadFailureReason = 'unknown'
      try {
        const res = await this.reloadFetch(webhookUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-hisabche-infra-signature': sig,
          },
          body: bodyJson,
        })
        reloadOk = res.ok
        if (!res.ok) reloadFailureReason = `HTTP ${res.status}`
      } catch (err) {
        reloadFailureReason = err instanceof Error ? err.message : 'webhook unreachable'
      }

      if (!reloadOk) {
        this.currentSettings = previous
        setServiceModeInput({ maintenance: previous.maintenanceMode })
        await supabase.from('feature_flags').upsert(
          {
            key: INFRASTRUCTURE_FLAG_KEY,
            name: 'Infrastructure & Nginx Control Plane',
            description: JSON.stringify(previous),
            is_enabled: previous.nginxProxyEnabled,
            rollout_percentage: previous.nginxProxyEnabled ? 100 : 0,
            platforms: [],
            countries: [],
            is_beta: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' },
        )
        throw new DatabaseError(
          `Nginx reload webhook failed (${reloadFailureReason}); settings rolled back to previous state.`,
        )
      }
    }

    try {
      await AdminSecurityService.logSecurityEvent({
        eventType: 'INFRASTRUCTURE_SETTINGS_UPDATED',
        adminEmail,
        details: {
          previous,
          updated: validated,
        },
      })
    } catch {
      // Security event logging should not block configuration updates in dev/test
    }

    return { ...this.currentSettings }
  }

  resetToDefaults(): InfrastructureSettings {
    this.currentSettings = {
      ...DEFAULT_INFRASTRUCTURE_SETTINGS,
      edgeControlMode: currentEdgeControlMode(),
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    }
    this.lastReadMs = 0
    this.inflight = null
    this.refreshEnabled = false
    this.reloadFetch = globalThis.fetch
    setServiceModeInput({ maintenance: false })
    return { ...this.currentSettings }
  }
}

export const adminInfrastructureService = new AdminInfrastructureService()
export function enableInfrastructureRefresh(): void {
  adminInfrastructureService.enableRefresh()
}
export function noteRequestForInfrastructure(nowMs: number = Date.now()): void {
  adminInfrastructureService.noteRequest(nowMs)
}
