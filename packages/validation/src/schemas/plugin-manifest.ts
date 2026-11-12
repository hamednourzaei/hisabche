import { z } from 'zod'
import { INTEGRATION_SCOPES } from './developer.schema'

export const pluginUiExtensionPointSchema = z.object({
  kind: z.enum(['menu_external_url', 'custom_field', 'report_template']),
  labelKey: z.string().min(1),
  externalUrl: z.string().url().optional(),
  targetEntity: z.string().optional(),
})

export const pluginManifestSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  scopes: z.array(z.enum(INTEGRATION_SCOPES)).min(1),
  uiExtensions: z.array(pluginUiExtensionPointSchema).default([]),
})

export const WORKSPACE_2FA_STEP_UP_CAPABILITIES = [
  'ledger.lock_period',
  'payroll.manage',
  'role.manage',
  'bank.manage',
] as const

export function requiresWorkspace2faStepUp(
  capability: string,
  configuredCapabilities: readonly string[] = WORKSPACE_2FA_STEP_UP_CAPABILITIES,
): boolean {
  return configuredCapabilities.includes(capability)
}
