// ============================================
// backend/src/services/admin/admin-infrastructure.service.ts
//
// Admin Infrastructure & Nginx Control Service.
// Persists edge proxy, rate limiting, cache bypass, HSTS, and emergency
// maintenance settings in the reserved `feature_flags` row
// (`INFRASTRUCTURE_FLAG_KEY`) so stateless backend instances stay synced
// without extra migrations, while keeping an in-process cache for fast hooks.
// ============================================

import {
  DEFAULT_INFRASTRUCTURE_SETTINGS,
  buildNginxConfigDirectives,
  infrastructureSettingsSchema,
  type InfrastructureSettings,
  type UpdateInfrastructureSettingsInput,
  updateInfrastructureSettingsSchema,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { INFRASTRUCTURE_FLAG_KEY } from '../../runtime/maintenance-mode'
import { setServiceModeInput } from '../../runtime/service-mode'
import { AdminSecurityService } from './admin-security.service'

const REFRESH_MS = 10_000

class AdminInfrastructureService {
  private currentSettings: InfrastructureSettings = {
    ...DEFAULT_INFRASTRUCTURE_SETTINGS,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  }
  private lastReadMs = 0
  private inflight: Promise<InfrastructureSettings> | null = null
  private refreshEnabled = false

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
              updatedAt: parsed.data.updatedAt ?? data.updated_at ?? this.currentSettings.updatedAt,
            }
            if (this.currentSettings.maintenanceMode) {
              setServiceModeInput({ maintenance: true })
            }
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
    next.updatedAt = now
    next.updatedBy = adminEmail
    this.currentSettings = next
    this.lastReadMs = Date.now()

    if (validated.maintenanceMode !== undefined) {
      setServiceModeInput({ maintenance: next.maintenanceMode })
    }

    try {
      await supabase.from('feature_flags').upsert(
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
    } catch {
      // Tolerate unmigrated/mock DB in dev/unit test runs while keeping in-process state consistent
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
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    }
    this.lastReadMs = 0
    this.inflight = null
    this.refreshEnabled = false
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
