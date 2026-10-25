import { supabase } from '../db'
import type { TenancyContext } from './tenancy.service'

export interface CoreDivergenceRecord {
  workspaceId: string
  capability: string
  command: string
  commandPayload: Record<string, unknown>
  expectedOutput: unknown
  actualOutput: unknown
  diffSummary: string
  rulesVersion?: string
  coreVersion?: string
}

export type ExecutionAuthority = 'SERVER_LEGACY' | 'SHADOW_MODE' | 'LOCAL_CORE'

// Global kill-switches and mode flags per capability
const killSwitches = new Map<string, boolean>()
let globalShadowModeEnabled = false

export class CoreDivergenceService {
  static setShadowMode(enabled: boolean): void {
    globalShadowModeEnabled = enabled
  }

  static isShadowModeEnabled(): boolean {
    return globalShadowModeEnabled
  }

  static setKillSwitch(capability: string, activated: boolean): void {
    killSwitches.set(capability, activated)
  }

  static getAuthority(capability: string): ExecutionAuthority {
    if (killSwitches.get(capability)) {
      return 'SERVER_LEGACY'
    }
    if (globalShadowModeEnabled) {
      return 'SHADOW_MODE'
    }
    return 'LOCAL_CORE'
  }

  /**
   * Records a detected divergence to the database (and in-memory for testing).
   */
  static async recordDivergence(record: CoreDivergenceRecord): Promise<void> {
    try {
      await supabase.from('core_divergence' as never).insert({
        workspace_id: record.workspaceId,
        capability: record.capability,
        command: record.command,
        command_payload: record.commandPayload,
        expected_output: record.expectedOutput,
        actual_output: record.actualOutput,
        diff_summary: record.diffSummary,
        rules_version: record.rulesVersion ?? '1.0.0',
        core_version: record.coreVersion ?? '2.0.0',
      } as never)
    } catch {
      // In testing or without live db, never fail the primary business request
    }
  }

  /**
   * Executes in shadow mode: runs legacy logic and core logic, detects differences,
   * logs divergence if mismatched, and returns the authoritative output.
   */
  static async executeWithShadow<TInput extends Record<string, unknown>, TOutput>(
    context: TenancyContext,
    capability: string,
    command: string,
    input: TInput,
    legacyFn: (inp: TInput) => Promise<TOutput> | TOutput,
    coreFn: (inp: TInput) => Promise<TOutput> | TOutput,
  ): Promise<TOutput> {
    const authority = this.getAuthority(capability)

    if (authority === 'SERVER_LEGACY') {
      return await legacyFn(input)
    }

    if (authority === 'LOCAL_CORE') {
      return await coreFn(input)
    }

    // Shadow mode: Run both concurrently
    const legacyPromise = Promise.resolve().then(() => legacyFn(input))
    const corePromise = Promise.resolve().then(() => coreFn(input))

    const [legacyResult, coreResult] = await Promise.all([legacyPromise, corePromise])

    const canonicalLegacy = JSON.stringify(legacyResult)
    const canonicalCore = JSON.stringify(coreResult)

    if (canonicalLegacy !== canonicalCore) {
      await this.recordDivergence({
        workspaceId: context.workspaceId,
        capability,
        command,
        commandPayload: input,
        expectedOutput: legacyResult,
        actualOutput: coreResult,
        diffSummary: `DIVERGENCE: core output did not match legacy server output.`,
      })
    }

    // In shadow mode, legacy is still authoritative to protect production
    return legacyResult
  }
}
