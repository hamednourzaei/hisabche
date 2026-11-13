// ============================================
// backend/src/services/admin/admin-posture.service.ts
//
// V63 · S-6 — what an auditor asks first: «how do you know?».
//
// ⚠️ UNKNOWN IS NOT PASS.
//
// A check that could not be read (the table has not been created yet, the
// service returned nothing, the Vault is absent) reports `unknown` and the
// screen shows it as such. Reporting it as `pass` would turn this page into a
// decoration: the whole point is that it says «I cannot tell» instead of
// reassuring a reader who is about to sign off.
//
// Every fact is read from the database the console is actually connected to.
// Nothing here is hard-coded, and nothing is inferred from configuration that
// the request path does not use.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { isTestRuntime } from '../../runtime/test-runtime'
import { PLATFORM_SECRETS, listSecrets, secretsStillFromEnv } from '../secrets/secret-store'
import { adminIpAllowlistService } from './admin-ip-allowlist.service'
import { breakGlassEmail } from '../../middleware/platform-admin.middleware'

export type PostureStatus = 'pass' | 'fail' | 'unknown'

export interface PostureCheck {
  id: string
  status: PostureStatus
  /** What was measured, in numbers. Never a person's email or a secret. */
  evidence: string
  /** Remediation, when the status is not `pass`. */
  action: string | null
}

export interface AdminPostureReport {
  checks: PostureCheck[]
  generatedAt: string
  /** Counted, so the header cannot show «all good» while a check is unknown. */
  summary: { pass: number; fail: number; unknown: number }
}

const SCHEMA_ABSENT = new Set(['42P01', 'PGRST205'])

/**
 * A count that reports `unknown` when the table is missing, and fails loudly
 * on any other database error — a failed read is not «zero rows».
 */
async function countOrUnknown(
  table: string,
  filter?: { column: string; value: string | boolean },
): Promise<{ value: number | null; note: string }> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  if (filter) query = query.eq(filter.column, filter.value)

  const { count, error } = await query
  if (error) {
    if (SCHEMA_ABSENT.has(error.code)) return { value: null, note: `${table} is not installed` }
    throw new DatabaseError(`Failed to read ${table} for the security posture`, error)
  }
  return { value: count ?? null, note: '' }
}

async function secretsCheck(): Promise<PostureCheck> {
  const metadata = await listSecrets()
  const fromEnv = await secretsStillFromEnv(Object.values(PLATFORM_SECRETS))

  // The store being absent is distinguishable from «no secrets yet»: an empty
  // list from a missing Vault means we genuinely do not know.
  if (metadata.length === 0 && fromEnv.length === 0) {
    return {
      id: 'secrets.in_vault',
      status: 'unknown',
      evidence: 'No stored secret was readable — the Vault may not be installed on this database',
      action: 'Apply docs/admin-secrets-01-migration.sql and move the keys into Vault',
    }
  }

  if (fromEnv.length > 0) {
    return {
      id: 'secrets.in_vault',
      status: 'fail',
      evidence: `${fromEnv.length} secret(s) were served from the environment in this process`,
      action: 'Rotate each one through Security → Secrets so it is stored in Vault',
    }
  }

  return {
    id: 'secrets.in_vault',
    status: 'pass',
    evidence: `${metadata.length} secret(s) indexed; none served from the environment in this process`,
    action: null,
  }
}

async function ipAllowlistCheck(): Promise<PostureCheck> {
  const entries = await adminIpAllowlistService.listEntries()
  if (entries.length === 0) {
    return {
      id: 'network.ip_allowlist',
      status: 'fail',
      evidence: 'The allow-list is empty, so the console accepts admin sessions from any network',
      action: 'Add the office and VPN ranges in Security → Network',
    }
  }
  return {
    id: 'network.ip_allowlist',
    status: 'pass',
    evidence: `${entries.length} range(s) configured; every other address is refused`,
    action: null,
  }
}

async function pendingApprovalsCheck(): Promise<PostureCheck> {
  const pending = await countOrUnknown('admin_action_requests', {
    column: 'status',
    value: 'PENDING',
  })
  if (pending.value === null) {
    return {
      id: 'approvals.pending',
      status: 'unknown',
      evidence: pending.note,
      action: 'Apply docs/admin-04-billing-migration.sql',
    }
  }
  return {
    id: 'approvals.pending',
    status: pending.value === 0 ? 'pass' : 'fail',
    evidence:
      pending.value === 0
        ? 'No maker-checker request is waiting'
        : `${pending.value} maker-checker request(s) are waiting for a second admin`,
    action: pending.value === 0 ? null : 'Review them in Billing → Approvals',
  }
}

async function adminAccountsCheck(): Promise<PostureCheck> {
  const total = await countOrUnknown('admin_accounts')
  if (total.value === null) {
    return {
      id: 'accounts.registered',
      status: 'unknown',
      evidence: total.note,
      action: 'Apply docs/admin-02-security-migration.sql',
    }
  }

  const active = await countOrUnknown('admin_accounts', { column: 'is_active', value: true })
  if (active.value === null) {
    return {
      id: 'accounts.registered',
      status: 'unknown',
      evidence: 'The active-admin count could not be read',
      action: null,
    }
  }

  if (active.value === 0) {
    return {
      id: 'accounts.registered',
      status: 'fail',
      evidence: `${total.value} admin account(s) registered, none active`,
      action: 'Activate at least one admin account in Security → Roles',
    }
  }

  return {
    id: 'accounts.registered',
    status: 'pass',
    evidence: `${active.value} active of ${total.value} registered admin account(s)`,
    action: null,
  }
}

function runtimeCheck(): PostureCheck {
  const test = isTestRuntime()
  return {
    id: 'runtime.production',
    status: test ? 'fail' : 'pass',
    evidence: test
      ? 'This server is running with the test-runtime marker, which bypasses MFA'
      : 'No test-runtime marker is present',
    action: test ? 'Restart the server without VITEST / testRuntime' : null,
  }
}

function breakGlassCheck(): PostureCheck {
  const email = breakGlassEmail()
  return {
    id: 'network.break_glass',
    status: email ? 'pass' : 'unknown',
    evidence: email
      ? 'A break-glass admin is configured (address not shown here)'
      : 'Neither the break-glass address nor the admin allow-list is set on this server',
    action: email ? null : 'Set ADMIN_BREAK_GLASS_EMAIL so a wrong range cannot lock the owner out',
  }
}

export class AdminPostureService {
  /**
   * ⚠️ NOT CACHED. A stale «pass» on a security page is a false assurance; the
   * page is opened rarely and each read is a handful of counts.
   */
  static async report(): Promise<AdminPostureReport> {
    const checks: PostureCheck[] = [
      runtimeCheck(),
      breakGlassCheck(),
      await ipAllowlistCheck(),
      await secretsCheck(),
      await adminAccountsCheck(),
      await pendingApprovalsCheck(),
    ]

    const summary = { pass: 0, fail: 0, unknown: 0 }
    for (const check of checks) summary[check.status] += 1

    return { checks, generatedAt: new Date().toISOString(), summary }
  }
}
