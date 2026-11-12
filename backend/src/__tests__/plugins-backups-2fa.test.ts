import { describe, expect, it } from 'vitest'
import { pluginManifestSchema, requiresWorkspace2faStepUp } from '@hisabche/validation'
import { hashRecoveryCode } from '../services/authorization/workspace-2fa.service'

describe('B.2.20, B.2.24, B.2.25 Plugins, Backups/Sandbox, Workspace 2FA', () => {
  it('validates declarative plugin manifest scopes and UI extensions', () => {
    const parsed = pluginManifestSchema.safeParse({
      id: 'ext-reports',
      name: 'External Reports',
      scopes: ['read:invoices', 'ui:widget'],
      uiExtensions: [
        {
          kind: 'menu_external_url',
          labelKey: 'plugins.extReports',
          externalUrl: 'https://example.com/app',
        },
      ],
    })
    expect(parsed.success).toBe(true)
  })

  it('requires step-up for sensitive capabilities and hashes recovery codes deterministically', () => {
    expect(requiresWorkspace2faStepUp('ledger.lock_period')).toBe(true)
    expect(requiresWorkspace2faStepUp('product.read')).toBe(false)
    expect(hashRecoveryCode('abcd-1234')).toBe(hashRecoveryCode(' ABCD-1234 '))
  })
})
