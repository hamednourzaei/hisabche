// ============================================
// backend/src/services/tax/tax.service.ts
//
// Tax configuration, resolution, and the frozen snapshot a document carries.
//
// The arithmetic is all in tax.domain.ts and is pure. What is here is the part
// that reads a workspace's configuration and decides which components apply.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'

import {
  computeDocument,
  resolveRule,
  toMinor,
  validateComponents,
  type ComputedDocument,
  type RoundingPolicy,
  type TaxComponent,
  type TaxRule,
  type TaxableLine,
} from './tax.domain'
import { detectDrift, type TaxDrift, type TaxSnapshot } from './tax.snapshot'

const COMPONENT_COLUMNS =
  'id, label_key, computation, treatment, rate, included_in_price, compounds_on, is_withholding, account_id, is_active'

const RULE_COLUMNS =
  'id, component_ids, product_id, category_id, party_tax_category, valid_from, valid_to, priority'

function mapComponent(raw: Record<string, any>): TaxComponent {
  return {
    id: raw.id,
    labelKey: raw.label_key,
    computation: raw.computation,
    treatment: raw.treatment,
    rate: Number(raw.rate) || 0,
    includedInPrice: raw.included_in_price === true,
    compoundsOn: (raw.compounds_on as string[]) ?? [],
    isWithholding: raw.is_withholding === true,
    accountId: raw.account_id ?? null,
  }
}

function mapRule(raw: Record<string, any>): TaxRule {
  return {
    id: raw.id,
    componentIds: (raw.component_ids as string[]) ?? [],
    productId: raw.product_id ?? null,
    categoryId: raw.category_id ?? null,
    partyTaxCategory: raw.party_tax_category ?? null,
    validFrom: raw.valid_from ?? null,
    validTo: raw.valid_to ?? null,
    priority: Number(raw.priority) || 100,
  }
}

export interface TaxSettings {
  /** Bumped on every configuration change; a document's snapshot records it. */
  configVersion: number
  policy: RoundingPolicy
  /** Retail pricing in Afghanistan is normally quoted tax-inclusive. */
  pricesIncludeTaxByDefault: boolean
}

const DEFAULT_SETTINGS: TaxSettings = {
  configVersion: 1,
  policy: 'per_line',
  pricesIncludeTaxByDefault: false,
}

export class TaxService {
  private key(workspaceId: string, ...parts: string[]) {
    return `tax:${workspaceId}:${parts.join(':')}`
  }

  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`tax:${workspaceId}`)
  }

  // ─── Configuration ────────────────────────────────────────────────────────

  async getSettings(workspaceId: string): Promise<TaxSettings> {
    const cacheKey = this.key(workspaceId, 'settings')

    const cached = await memoryCache.get<TaxSettings>(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('tax_settings')
      .select('config_version, rounding_policy, prices_include_tax')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to read tax settings', error)

    const settings: TaxSettings = data
      ? {
          configVersion: Number(data.config_version) || 1,
          policy: (data.rounding_policy as RoundingPolicy) ?? 'per_line',
          pricesIncludeTaxByDefault: data.prices_include_tax === true,
        }
      : DEFAULT_SETTINGS

    await memoryCache.set(cacheKey, settings, 300)
    return settings
  }

  async listComponents(workspaceId: string, includeInactive = false): Promise<TaxComponent[]> {
    const cacheKey = this.key(workspaceId, 'components', String(includeInactive))

    const cached = await memoryCache.get<TaxComponent[]>(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('tax_components')
      .select(COMPONENT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('label_key')

    if (!includeInactive) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch tax components', error)

    const components = (data ?? []).map(mapComponent)
    await memoryCache.set(cacheKey, components, 300)
    return components
  }

  async listRules(workspaceId: string): Promise<TaxRule[]> {
    const cacheKey = this.key(workspaceId, 'rules')

    const cached = await memoryCache.get<TaxRule[]>(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('tax_rules')
      .select(RULE_COLUMNS)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('priority')

    if (error) throw new DatabaseError('Failed to fetch tax rules', error)

    const rules = (data ?? []).map(mapRule)
    await memoryCache.set(cacheKey, rules, 300)
    return rules
  }

  private assertMayConfigure(ctx: TenancyContext) {
    // Changing a rate changes what every future document charges. Owner only,
    // the same bar as locking a period.
    if (ctx.role !== 'owner') throw new ConflictError('TAX_CONFIGURE_FORBIDDEN')
  }

  /**
   * Save a component, and BUMP THE CONFIG VERSION.
   *
   * The bump is the whole mechanism that lets an offline device find out its
   * snapshot is stale. Forgetting it would make every drift check pass.
   */
  async upsertComponent(ctx: TenancyContext, input: TaxComponent): Promise<TaxComponent> {
    this.assertMayConfigure(ctx)

    const existing = await this.listComponents(ctx.workspaceId, true)
    const merged = [...existing.filter((c) => c.id !== input.id), input]

    const problems = validateComponents(merged)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const { data, error } = await supabase
      .from('tax_components')
      .upsert(
        {
          id: input.id,
          workspace_id: ctx.workspaceId,
          label_key: input.labelKey,
          computation: input.computation,
          treatment: input.treatment,
          rate: input.rate,
          included_in_price: input.includedInPrice,
          compounds_on: input.compoundsOn ?? [],
          is_withholding: input.isWithholding === true,
          account_id: input.accountId ?? null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      .select(COMPONENT_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to save tax component', error)

    await this.bumpConfigVersion(ctx)
    return mapComponent(data)
  }

  async upsertRule(ctx: TenancyContext, input: TaxRule): Promise<TaxRule> {
    this.assertMayConfigure(ctx)

    const known = new Set((await this.listComponents(ctx.workspaceId, true)).map((c) => c.id))
    if (input.componentIds.some((id) => !known.has(id))) {
      throw new ValidationError('TAX_COMPONENT_UNKNOWN')
    }

    const { data, error } = await supabase
      .from('tax_rules')
      .upsert(
        {
          id: input.id,
          workspace_id: ctx.workspaceId,
          component_ids: input.componentIds,
          product_id: input.productId ?? null,
          category_id: input.categoryId ?? null,
          party_tax_category: input.partyTaxCategory ?? null,
          valid_from: input.validFrom ?? null,
          valid_to: input.validTo ?? null,
          priority: input.priority,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      .select(RULE_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to save tax rule', error)

    await this.bumpConfigVersion(ctx)
    return mapRule(data)
  }

  private async bumpConfigVersion(ctx: TenancyContext) {
    const current = await this.getSettings(ctx.workspaceId)

    const { error } = await supabase.from('tax_settings').upsert(
      {
        workspace_id: ctx.workspaceId,
        config_version: current.configVersion + 1,
        rounding_policy: current.policy,
        prices_include_tax: current.pricesIncludeTaxByDefault,
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId,
      },
      { onConflict: 'workspace_id' },
    )

    if (error) throw new DatabaseError('Failed to bump the tax config version', error)
    await this.invalidate(ctx.workspaceId)
  }

  // ─── Resolution and freezing ──────────────────────────────────────────────

  /**
   * Work out the tax on a document AND freeze what produced it.
   *
   * Returns both the figures and a snapshot containing every input. The
   * snapshot travels with the document, so the same numbers can be reproduced
   * on the phone that wrote it and on the server three years later.
   */
  async computeAndFreeze(
    ctx: TenancyContext,
    document: {
      /** The DOCUMENT's date. A backdated invoice uses the rate of its own day. */
      date: string
      partyTaxCategory?: string | null | undefined
      lines: Array<{
        lineId: string
        productId?: string | null | undefined
        categoryId?: string | null | undefined
        quantity: number
        unitPrice: number
        discount?: number | undefined
      }>
    },
  ): Promise<{ computed: ComputedDocument; snapshot: TaxSnapshot }> {
    const [components, rules, settings] = await Promise.all([
      this.listComponents(ctx.workspaceId),
      this.listRules(ctx.workspaceId),
      this.getSettings(ctx.workspaceId),
    ])

    const byId = new Map(components.map((c) => [c.id, c]))
    const onDate = document.date.slice(0, 10)

    const ruleByLine: Record<string, string | null> = {}
    const used = new Map<string, TaxComponent>()

    const taxable: TaxableLine[] = document.lines.map((line) => {
      const rule = resolveRule(rules, {
        productId: line.productId ?? null,
        categoryId: line.categoryId ?? null,
        partyTaxCategory: document.partyTaxCategory ?? null,
        onDate,
      })

      ruleByLine[line.lineId] = rule?.id ?? null

      const lineComponents = (rule?.componentIds ?? [])
        .map((id) => byId.get(id))
        .filter((c): c is TaxComponent => Boolean(c))

      for (const component of lineComponents) used.set(component.id, component)

      return {
        lineId: line.lineId,
        quantity: line.quantity,
        unitPriceMinor: toMinor(line.unitPrice),
        discountMinor: toMinor(line.discount ?? 0),
        components: lineComponents,
      }
    })

    const computed = computeDocument(taxable, settings.policy)

    const snapshot: TaxSnapshot = {
      configVersion: settings.configVersion,
      resolvedOn: onDate,
      resolvedAt: new Date().toISOString(),
      ruleByLine,
      // A COPY of every component used, not a reference. A snapshot pointing
      // at a live row silently changes meaning when somebody edits that row.
      components: [...used.values()].map((c) => ({ ...c })),
      policy: settings.policy,
    }

    return { computed, snapshot }
  }

  /**
   * Has the configuration moved since this document was written?
   *
   * Reports the difference; changes nothing. The invoice the customer holds
   * keeps the figures it was issued with, and correcting it is a decision with
   * a credit note attached.
   */
  async checkDrift(ctx: TenancyContext, snapshot: TaxSnapshot): Promise<TaxDrift[]> {
    const [components, settings] = await Promise.all([
      this.listComponents(ctx.workspaceId),
      this.getSettings(ctx.workspaceId),
    ])

    return detectDrift(snapshot, { configVersion: settings.configVersion, components })
  }

  /** The base-and-tax figures a return is filed from. */
  async getTaxReturn(ctx: TenancyContext, from: string, to: string) {
    const { data, error } = await supabase
      .from('invoice_tax_lines')
      .select('component_id, label_key, treatment, rate, base_minor, amount_minor, direction')
      .eq('workspace_id', ctx.workspaceId)
      .gte('entry_date', from.slice(0, 10))
      .lte('entry_date', to.slice(0, 10))
      .limit(50_000)

    if (error) throw new DatabaseError('Failed to build the tax return', error)

    const rows = new Map<
      string,
      {
        componentId: string
        labelKey: string
        treatment: string
        rate: number
        outputBaseMinor: number
        outputTaxMinor: number
        inputBaseMinor: number
        inputTaxMinor: number
      }
    >()

    for (const row of data ?? []) {
      const key = `${row.component_id}:${row.rate}`
      const entry = rows.get(key) ?? {
        componentId: row.component_id,
        labelKey: row.label_key,
        treatment: row.treatment,
        rate: Number(row.rate) || 0,
        outputBaseMinor: 0,
        outputTaxMinor: 0,
        inputBaseMinor: 0,
        inputTaxMinor: 0,
      }

      // Output tax is what was charged on sales; input tax is what was paid on
      // purchases. They net off on a return and must never be summed together.
      if (row.direction === 'sale') {
        entry.outputBaseMinor += Number(row.base_minor) || 0
        entry.outputTaxMinor += Number(row.amount_minor) || 0
      } else {
        entry.inputBaseMinor += Number(row.base_minor) || 0
        entry.inputTaxMinor += Number(row.amount_minor) || 0
      }

      rows.set(key, entry)
    }

    const lines = [...rows.values()]
    const outputTax = lines.reduce((sum, l) => sum + l.outputTaxMinor, 0)
    const inputTax = lines.reduce((sum, l) => sum + l.inputTaxMinor, 0)

    return {
      from: from.slice(0, 10),
      to: to.slice(0, 10),
      lines,
      outputTaxMinor: outputTax,
      inputTaxMinor: inputTax,
      /** Positive means payable to the authority; negative means reclaimable. */
      netPayableMinor: outputTax - inputTax,
    }
  }
}
