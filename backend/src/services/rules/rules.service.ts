// ============================================
// backend/src/services/rules/rules.service.ts
//
// Storing business rules, and evaluating them for a document.
//
// The service stores and fetches. The deciding is all in rules.domain.ts and
// is pure, so "why did this invoice need approval" can be answered in a test
// with no database and no invoice.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'

import {
  evaluateRules,
  summarise,
  validateRule,
  type BusinessRule,
  type ConditionGroup,
  type RuleAction,
  type RuleEntity,
  type RuleFacts,
} from './rules.domain'

const COLUMNS =
  'id, workspace_id, name, entity, conditions, actions, priority, active, stop_on_match, created_at, updated_at'

function mapRule(raw: Record<string, any>): BusinessRule {
  return {
    id: raw.id,
    workspaceId: raw.workspace_id,
    name: raw.name,
    entity: raw.entity,
    conditions: raw.conditions ?? { match: 'all', conditions: [] },
    actions: raw.actions ?? [],
    priority: Number(raw.priority) || 0,
    active: raw.active !== false,
    stopOnMatch: raw.stop_on_match === true,
  }
}

export class RulesService {
  private key(workspaceId: string, ...parts: string[]) {
    return `rules:${workspaceId}:${parts.join(':')}`
  }

  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`rules:${workspaceId}`)
  }

  async list(ctx: TenancyContext, entity?: RuleEntity): Promise<BusinessRule[]> {
    const cacheKey = this.key(ctx.workspaceId, 'list', entity ?? 'all')

    const cached = await memoryCache.get<BusinessRule[]>(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('business_rules')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .order('priority')

    if (entity) query = query.eq('entity', entity)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch business rules', error)

    const found = (data ?? []).map(mapRule)
    await memoryCache.set(cacheKey, found, 300)
    return found
  }

  async get(ctx: TenancyContext, id: string): Promise<BusinessRule> {
    const { data, error } = await supabase
      .from('business_rules')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch business rule', error)
    if (!data) throw new NotFoundError('Business rule')
    return mapRule(data)
  }

  /**
   * Writing a rule changes what happens to everyone's documents, so it is an
   * owner's or manager's act — the same bar as changing the chart of accounts.
   */
  private assertMayManage(ctx: TenancyContext) {
    if (ctx.role !== 'owner' && ctx.role !== 'manager') {
      throw new ConflictError('RULE_MANAGE_FORBIDDEN')
    }
  }

  async create(
    ctx: TenancyContext,
    input: {
      name: string
      entity: RuleEntity
      conditions: ConditionGroup
      actions: RuleAction[]
      priority?: number | undefined
      active?: boolean | undefined
      stopOnMatch?: boolean | undefined
    },
  ): Promise<BusinessRule> {
    this.assertMayManage(ctx)

    const problems = validateRule(input)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const { data, error } = await supabase
      .from('business_rules')
      .insert({
        workspace_id: ctx.workspaceId,
        name: input.name,
        entity: input.entity,
        conditions: input.conditions,
        actions: input.actions,
        priority: input.priority ?? 100,
        active: input.active !== false,
        stop_on_match: input.stopOnMatch === true,
        created_by: ctx.userId,
      })
      .select(COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create business rule', error)

    await this.invalidate(ctx.workspaceId)
    return mapRule(data)
  }

  async update(
    ctx: TenancyContext,
    id: string,
    input: {
      name?: string | undefined
      conditions?: ConditionGroup | undefined
      actions?: RuleAction[] | undefined
      priority?: number | undefined
      active?: boolean | undefined
      stopOnMatch?: boolean | undefined
    },
  ): Promise<BusinessRule> {
    this.assertMayManage(ctx)

    const current = await this.get(ctx, id)
    const problems = validateRule({
      name: input.name ?? current.name,
      conditions: input.conditions ?? current.conditions,
      actions: input.actions ?? current.actions,
    })
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const values: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.name !== undefined) values.name = input.name
    if (input.conditions !== undefined) values.conditions = input.conditions
    if (input.actions !== undefined) values.actions = input.actions
    if (input.priority !== undefined) values.priority = input.priority
    if (input.active !== undefined) values.active = input.active
    if (input.stopOnMatch !== undefined) values.stop_on_match = input.stopOnMatch

    const { data, error } = await supabase
      .from('business_rules')
      .update(values)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select(COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update business rule', error)

    await this.invalidate(ctx.workspaceId)
    return mapRule(data)
  }

  /**
   * A rule is deactivated, not deleted, once it has decided anything: the
   * decisions it produced reference it, and "which rule required this
   * approval" must still have an answer next year.
   */
  async deactivate(ctx: TenancyContext, id: string): Promise<BusinessRule> {
    return this.update(ctx, id, { active: false })
  }

  /**
   * What the rules say about this document.
   *
   * Returns DECISIONS. It applies nothing — the caller starts the approval,
   * refuses the save, or shows the warning, because those are domain acts.
   */
  async evaluate(ctx: TenancyContext, entity: RuleEntity, facts: RuleFacts) {
    const found = await this.list(ctx, entity)
    const decisions = evaluateRules(found, entity, facts)

    return { decisions, ...summarise(decisions) }
  }

  /**
   * Evaluate a rule that has not been saved yet, against real facts.
   *
   * The point is that somebody writing "discount over 15% needs approval" can
   * see what it would have done to last week's invoices BEFORE it starts
   * blocking this week's.
   */
  async dryRun(
    ctx: TenancyContext,
    rule: {
      name: string
      entity: RuleEntity
      conditions: ConditionGroup
      actions: RuleAction[]
      priority?: number | undefined
    },
    facts: RuleFacts[],
  ) {
    const problems = validateRule(rule)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const candidate: BusinessRule = {
      id: 'dry-run',
      workspaceId: ctx.workspaceId,
      name: rule.name,
      entity: rule.entity,
      conditions: rule.conditions,
      actions: rule.actions,
      priority: rule.priority ?? 100,
      active: true,
    }

    return facts.map((fact) => ({
      facts: fact,
      decisions: evaluateRules([candidate], rule.entity, fact),
    }))
  }
}
