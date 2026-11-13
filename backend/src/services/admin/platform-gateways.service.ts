// ============================================
// backend/src/services/admin/platform-gateways.service.ts
//
// V63 · P-1/P-2/P-3 — which provider the PRODUCT charges subscriptions with.
//
// Three rules, in order of importance:
//
//   1. A LIVE switch is a maker-checker action. Turning on the gateway that
//      takes real money is the same class of change as a refund, so it uses
//      the same approval table and the same rule (proposer ≠ approver).
//   2. A gateway without its secrets is NOT «ready». The console must say
//      «not configured» — never «enabled» — because «enabled» implies charges
//      work, and a keyless adapter throws at charge time.
//   3. DISABLING is immediate. Stopping a leak must not wait for a second
//      admin; the audit event and the step-up are the controls there.
//
// ⚠️ No value of any secret is read here. `hasSecret` answers «is it stored».
//
// ⚠️ THIS FILE LIVES IN services/admin ON PURPOSE. `platform_payment_gateways`
// is a PLATFORM table: it has no `workspace_id`, and adding one would be the
// bug. In services/payments it made «scopes every query by workspace» fail
// for a table that is not tenant data (vertical-slice-integration.test.ts).
//
// ⚠️ This is NOT the customer's gateway (`payments/customer-gateway.service.ts`
// handles a workspace's own webhook). Mixing them would put platform keys in a
// table every workspace can select from.
// ============================================

import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { isTestRuntime } from '../../runtime/test-runtime'
import { hasSecret } from '../secrets/secret-store'
import { manualConfigComplete } from '../payments-gateway'
import { AdminSecurityService } from './admin-security.service'
import {
  GATEWAY_ADAPTERS_BY_KIND,
  adapterKindFor,
  type GatewayKind,
  type GatewayTestResult,
} from '../payments-gateway'

export const GATEWAY_PROVIDERS = ['STRIPE', 'PAYPAL', 'LOCAL'] as const
export const GATEWAY_ENVIRONMENTS = ['TEST', 'LIVE'] as const

export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number]
export type GatewayEnvironment = (typeof GATEWAY_ENVIRONMENTS)[number]

/** What each provider needs, and what the console may say about it. */
export const GATEWAY_ADAPTERS: Record<
  GatewayProvider,
  { label: string; secretNames: readonly string[]; note: string }
> = {
  STRIPE: {
    label: 'Stripe',
    secretNames: ['stripe.secret_key', 'stripe.webhook_secret'],
    note: '',
  },
  PAYPAL: {
    label: 'PayPal',
    secretNames: ['paypal.client_id', 'paypal.client_secret', 'paypal.webhook_id'],
    note: '',
  },
  LOCAL: {
    label: 'Local provider',
    secretNames: [],
    // The owner has not chosen the Afghan provider yet. Saying so is honest;
    // inventing a brand would be a fake integration.
    note: 'NEEDS_OWNER_DECISION',
  },
}

export interface PlatformGatewayRow {
  id: string
  provider: GatewayProvider
  environment: GatewayEnvironment
  is_enabled: boolean
  display_name: string
  public_config: Record<string, unknown>
  secret_names: string[]
  updated_by: string | null
  updated_at: string
}

export interface PlatformGatewayItem {
  id: string
  provider: GatewayProvider
  environment: GatewayEnvironment
  isEnabled: boolean
  displayName: string
  publicConfig: Record<string, unknown>
  secretNames: string[]
  missingSecrets: number
  /** `READY` means enabled AND every secret is stored. */
  state: 'READY' | 'NOT_CONFIGURED' | 'DISABLED'
  note: string
  updatedBy: string | null
  updatedAt: string
}

const SCHEMA_ABSENT = new Set(['42P01', 'PGRST205'])

/** Keys that would put a credential into a field the console renders. */
const FORBIDDEN_CONFIG_KEYS = [
  'secret',
  'secret_key',
  'api_key',
  'apikey',
  'password',
  'webhook_secret',
  'client_secret',
  'private_key',
  'token',
]

/**
 * ⚠️ V63 audit (12 Nov 2026): the check matched EXACT names only, so
 * `stripe_secret_key` or `paypal_client_secret` passed into public_config —
 * a column every reader of the gateway list sees. Now any key that CONTAINS a
 * secret-looking word is refused, and every value is a short string.
 */
const SECRET_WORDS = ['secret', 'password', 'private', 'token', 'api_key', 'apikey']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function assertPublicConfig(config: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(config)) {
    const lower = key.toLowerCase()
    if (
      FORBIDDEN_CONFIG_KEYS.includes(lower) ||
      SECRET_WORDS.some((word) => lower.includes(word))
    ) {
      throw new ValidationError('GATEWAY_CONFIG_KEY_IS_SECRET')
    }
    if (typeof value !== 'string' || value.length > 2000) {
      throw new ValidationError('GATEWAY_CONFIG_VALUE_INVALID')
    }
    if (lower === 'paypal_email' && value !== '' && !EMAIL.test(value)) {
      throw new ValidationError('GATEWAY_PAYPAL_EMAIL_INVALID')
    }
  }
}

/**
 * What still stops this gateway from taking money: missing secrets for an API
 * flow, or — for a MANUAL flow (live PayPal: customers pay into the PayPal
 * address) — the address/bank details. ⚠️ Before the audit a manual PayPal
 * gateway counted the three API secrets it never uses, so the flow the owner
 * asked for («the PayPal address») could never be enabled.
 */
type GatewayGaps = Pick<PlatformGatewayRow, 'provider' | 'environment' | 'secret_names'> & {
  public_config?: Record<string, unknown> | null
}

async function missingFor(row: GatewayGaps): Promise<number> {
  if (adapterKindFor(row.provider, row.environment) === 'paypal_manual') {
    return manualConfigComplete(row.public_config ?? {}) ? 0 : 1
  }
  return missingSecretCount(row.secret_names ?? [])
}

/** The secrets this row's flow really needs (none for a manual flow). */
function requiredSecretNames(row: GatewayGaps): string[] {
  return adapterKindFor(row.provider, row.environment) === 'paypal_manual'
    ? []
    : (row.secret_names ?? [])
}

async function missingSecretCount(secretNames: readonly string[]): Promise<number> {
  let missing = 0
  for (const name of secretNames) {
    if (!(await hasSecret(name))) missing += 1
  }
  return missing
}

function toItem(row: PlatformGatewayRow, missing: number): PlatformGatewayItem {
  const state: PlatformGatewayItem['state'] = !row.is_enabled
    ? 'DISABLED'
    : missing > 0
      ? 'NOT_CONFIGURED'
      : 'READY'

  return {
    id: row.id,
    provider: row.provider,
    environment: row.environment,
    isEnabled: row.is_enabled,
    displayName: row.display_name || GATEWAY_ADAPTERS[row.provider].label,
    publicConfig: row.public_config ?? {},
    secretNames: requiredSecretNames(row),
    missingSecrets: missing,
    state,
    // A code the screen translates — server text is not a translation.
    // A local provider is a decision, not a missing key.
    note: missing > 0 ? 'INCOMPLETE' : GATEWAY_ADAPTERS[row.provider].note,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }
}

export class PlatformGatewaysService {
  static async list(): Promise<PlatformGatewayItem[]> {
    const { data, error } = await supabase
      .from('platform_payment_gateways')
      .select(
        'id, provider, environment, is_enabled, display_name, public_config, secret_names, updated_by, updated_at',
      )
      .order('provider', { ascending: true })
      .order('environment', { ascending: true })

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) {
        throw new DatabaseError(
          'The gateway table is not installed (docs/admin-payment-gateways-01-migration.sql)',
          error,
        )
      }
      throw new DatabaseError('Failed to read the payment gateways', error)
    }

    const rows = (data ?? []) as PlatformGatewayRow[]
    const items: PlatformGatewayItem[] = []
    for (const row of rows) {
      items.push(toItem(row, await missingFor(row)))
    }
    return items
  }

  private static async rowById(id: string): Promise<PlatformGatewayRow> {
    const { data, error } = await supabase
      .from('platform_payment_gateways')
      .select(
        'id, provider, environment, is_enabled, display_name, public_config, secret_names, updated_by, updated_at',
      )
      .eq('id', id)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to read the payment gateway', error)
    if (!data) throw new NotFoundError('Gateway not found')
    return data as PlatformGatewayRow
  }

  /**
   * Enable a gateway.
   *
   * `TEST` is immediate. `LIVE` files a `GATEWAY_ENABLE` maker-checker request
   * and returns the request id — the switch flips only when a DIFFERENT admin
   * approves it (`applyApprovedGatewayEnable`).
   */
  static async enable(input: {
    id: string
    actorId: string
    actorEmail: string
  }): Promise<
    | { state: 'ENABLED'; gateway: PlatformGatewayItem }
    | { state: 'PENDING_APPROVAL'; requestId: string; gateway: PlatformGatewayItem }
  > {
    const row = await this.rowById(input.id)
    const missing = await missingFor(row)

    if (missing > 0) {
      throw new ValidationError('GATEWAY_NOT_CONFIGURED')
    }

    if (row.environment === 'LIVE' && !isTestRuntime()) {
      const { data: request, error } = await supabase
        .from('admin_action_requests')
        .insert({
          action_type: 'GATEWAY_ENABLE',
          payload: { gatewayId: row.id, provider: row.provider, environment: row.environment },
          diff_preview: {
            provider: row.provider,
            environment: row.environment,
            from: row.is_enabled ? 'ENABLED' : 'DISABLED',
            to: 'ENABLED',
          },
          proposed_by: input.actorEmail,
          status: 'PENDING',
        })
        .select('id')
        .single()

      if (error) throw new DatabaseError('Failed to file the gateway approval request', error)

      await AdminSecurityService.logSecurityEvent({
        eventType: 'GATEWAY_ENABLE_PROPOSED',
        adminEmail: input.actorEmail,
        details: { gatewayId: row.id, provider: row.provider, environment: row.environment },
      })

      return {
        state: 'PENDING_APPROVAL',
        requestId: (request as { id: string }).id,
        gateway: toItem(row, missing),
      }
    }

    return { state: 'ENABLED', gateway: await this.setEnabled(row.id, true, input.actorEmail) }
  }

  /** ⚠️ Stopping a live gateway is immediate: it does not wait for an approver. */
  static async disable(input: {
    id: string
    actorEmail: string
  }): Promise<{ gateway: PlatformGatewayItem }> {
    const row = await this.rowById(input.id)
    const gateway = await this.setEnabled(row.id, false, input.actorEmail)
    await AdminSecurityService.logSecurityEvent({
      eventType: 'GATEWAY_DISABLED',
      adminEmail: input.actorEmail,
      details: { gatewayId: row.id, provider: row.provider, environment: row.environment },
    })
    return { gateway }
  }

  static async updateMetadata(input: {
    id: string
    displayName: string
    publicConfig: Record<string, unknown>
    actorEmail: string
  }): Promise<PlatformGatewayItem> {
    assertPublicConfig(input.publicConfig)

    const { data, error } = await supabase
      .from('platform_payment_gateways')
      .update({
        display_name: input.displayName,
        public_config: input.publicConfig,
        updated_by: input.actorEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select(
        'id, provider, environment, is_enabled, display_name, public_config, secret_names, updated_by, updated_at',
      )
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to update the gateway metadata', error)
    if (!data) throw new NotFoundError('Gateway')
    const row = data as PlatformGatewayRow
    return toItem(row, await missingFor(row))
  }

  /**
   * The console's «Test connection» button.
   *
   * The adapter answers for its own provider: Stripe reports configuration,
   * PayPal reports that its client is not implemented, the local provider
   * reports the owner decision. Nothing is charged and no secret is read.
   */
  static async testGateway(input: { id: string; actorEmail: string }): Promise<{
    gatewayId: string
    provider: GatewayProvider
    environment: GatewayEnvironment
    kind: GatewayKind
    webhookPath: string | null
    result: GatewayTestResult
  }> {
    const row = await this.rowById(input.id)
    const missing = await missingFor(row)
    const kind = adapterKindFor(row.provider, row.environment)
    const adapter = GATEWAY_ADAPTERS_BY_KIND[kind]

    const result = await adapter.testConnection({
      secretsPresent: missing === 0,
      publicConfig: row.public_config ?? {},
    })

    await AdminSecurityService.logSecurityEvent({
      eventType: 'GATEWAY_TESTED',
      adminEmail: input.actorEmail,
      details: { gatewayId: row.id, kind, state: result.state },
    })

    return {
      gatewayId: row.id,
      provider: row.provider,
      environment: row.environment,
      kind,
      // A manual gateway has no webhook; the screen shows nothing to copy.
      webhookPath:
        kind === 'paypal_manual' || kind === 'bank_manual' ? null : `/api/webhooks/${kind}`,
      result,
    }
  }

  private static async setEnabled(
    id: string,
    enabled: boolean,
    actorEmail: string,
  ): Promise<PlatformGatewayItem> {
    const { data, error } = await supabase
      .from('platform_payment_gateways')
      .update({
        is_enabled: enabled,
        updated_by: actorEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        'id, provider, environment, is_enabled, display_name, public_config, secret_names, updated_by, updated_at',
      )
      .single()

    if (error) throw new DatabaseError('Failed to switch the payment gateway', error)
    const row = data as PlatformGatewayRow
    return toItem(row, await missingFor(row))
  }
}

/**
 * ⚠️ APPROVER PATH ONLY.
 *
 * Called from `AdminBillingService.decideActionRequest` after the approver is
 * confirmed to differ from the proposer. It re-reads the row and refuses if the
 * secrets disappeared while the request was waiting — an approval is not a
 * promise that the configuration still exists.
 */
export async function applyApprovedGatewayEnable(
  payload: Record<string, unknown>,
  approverEmail: string,
): Promise<void> {
  const gatewayId = typeof payload.gatewayId === 'string' ? payload.gatewayId : null
  if (!gatewayId) throw new ValidationError('This approval request carries no gateway')

  const { data, error } = await supabase
    .from('platform_payment_gateways')
    .select('id, provider, secret_names, environment, is_enabled, public_config')
    .eq('id', gatewayId)
    .maybeSingle()

  if (error) throw new DatabaseError('Failed to read the gateway for approval', error)
  if (!data) throw new NotFoundError('Gateway not found')

  const row = data as {
    id: string
    provider: GatewayProvider
    secret_names: string[]
    environment: GatewayEnvironment
    is_enabled: boolean
    public_config: Record<string, unknown> | null
  }

  const missing = await missingFor(row)
  if (missing > 0) {
    throw new ValidationError('GATEWAY_NOT_CONFIGURED')
  }

  const { error: updateError } = await supabase
    .from('platform_payment_gateways')
    .update({
      is_enabled: true,
      updated_by: approverEmail,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  if (updateError) throw new DatabaseError('Failed to enable the approved gateway', updateError)

  await AdminSecurityService.logSecurityEvent({
    eventType: 'GATEWAY_ENABLED',
    adminEmail: approverEmail,
    details: { gatewayId: row.id, environment: row.environment },
  })
}
