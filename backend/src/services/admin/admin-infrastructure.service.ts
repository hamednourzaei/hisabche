// ============================================
// backend/src/services/admin/admin-infrastructure.service.ts
//
// Admin Infrastructure & Nginx Control Service.
// Thread-safe in-memory state with audit logging.
// Manages Nginx reverse proxy, edge rate limiting, cache bypass,
// and maintenance mode toggle states.
// ============================================

import {
  DEFAULT_INFRASTRUCTURE_SETTINGS,
  type InfrastructureSettings,
  type UpdateInfrastructureSettingsInput,
  updateInfrastructureSettingsSchema,
} from '@hisabche/validation'
import { AdminSecurityService } from './admin-security.service'

class AdminInfrastructureService {
  private currentSettings: InfrastructureSettings = {
    ...DEFAULT_INFRASTRUCTURE_SETTINGS,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  }

  getSettings(): InfrastructureSettings {
    return { ...this.currentSettings }
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
    return { ...this.currentSettings }
  }
}

export const adminInfrastructureService = new AdminInfrastructureService()
