// ============================================
// backend/src/services/extensions/custom-fields.service.ts
//
// Capabilities #141–#143 — a business's own fields on a customer, a supplier
// or a product, including formula fields over its own number fields.
//
// ⚠️ ONLY THOSE THREE. Invoices, payments, the ledger and stock are not
// extensible (the domain's NEVER_EXTENSIBLE list says why); the entity enum
// here, the route's schema and the table's CHECK all say the same thing.
//
// ⚠️ A VALUE IS VALIDATED AGAINST ITS DEFINITION ON THE SERVER: type, choice
// membership, required. A key with no active definition is refused, not stored
// — the JSON object never holds something no field explains.
//
// ⚠️ A FORMULA HAS NO STORED VALUE. It is parsed when the field is created
// (`parseFormula`, against the number fields that exist) and evaluated when the
// record is read (`evaluateFormula`). A formula that cannot be computed for a
// record says why (`MISSING_VALUE`, `DIVIDE_BY_ZERO`) — it is never shown as 0.
//
// A field is retired (`is_active = false`), never deleted, and its key is never
// reused.
// ============================================

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import { evaluateFormula, parseFormula, type FieldDefinition } from './extension.domain'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])

export const CUSTOM_FIELD_ENTITIES = {
  customer: 'customers',
  supplier: 'suppliers',
  product: 'products',
} as const
export type CustomFieldEntity = keyof typeof CUSTOM_FIELD_ENTITIES
export const CUSTOM_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'boolean',
  'choice',
  'formula',
] as const
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]
/** A workspace gets this many fields per entity — a form, not a second database. */
export const MAX_FIELDS_PER_ENTITY = 30

export class CustomFieldsNotConfiguredError extends BaseError {
  constructor() {
    super('CUSTOM_FIELDS_MIGRATION_PENDING', 503)
    this.name = 'CustomFieldsNotConfiguredError'
  }
}

export interface CustomField {
  id: string
  key: string
  label: string
  type: CustomFieldType
  choices: string[] | null
  formula: string | null
  required: boolean
  isActive: boolean
}

export type StoredValue = string | number | boolean | null

export interface CustomFieldRecord {
  /** Active fields only, in the order they were made. */
  fields: CustomField[]
  values: Record<string, StoredValue>
  /** Formula fields: the value, or why it cannot be computed for this record. */
  computed: Record<string, { ok: true; value: number } | { ok: false; code: string }>
}

interface DefinitionRow {
  id: string
  key: string
  label: string
  field_type: CustomFieldType
  choices: string[] | null
  formula: string | null
  is_required: boolean
  is_active: boolean
}

const COLUMNS = 'id, key, label, field_type, choices, formula, is_required, is_active'
const toField = (row: DefinitionRow): CustomField => ({
  id: row.id,
  key: row.key,
  label: row.label,
  type: row.field_type,
  choices: row.choices,
  formula: row.formula,
  required: row.is_required,
  isActive: row.is_active,
})

/** The engine's view of the fields a formula may name: the number-like ones. */
const formulaInputs = (fields: readonly CustomField[]): FieldDefinition[] =>
  fields
    .filter((field) => field.type === 'number' || field.type === 'boolean')
    .map((field) => ({
      key: field.key,
      labelKey: field.label,
      type: field.type === 'boolean' ? 'boolean' : 'number',
      choices: null,
      required: field.required,
    }))

function fail(error: { code?: string; message: string }, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new CustomFieldsNotConfiguredError()
  throw new DatabaseError(what, error)
}

export class CustomFieldsService {
  async definitions(
    ctx: TenancyContext,
    entity: CustomFieldEntity,
    includeRetired = false,
  ): Promise<CustomField[]> {
    let query = supabase
      .from('custom_field_definitions')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('entity_type', entity)
    if (!includeRetired) query = query.eq('is_active', true)
    const { data, error } = await query
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(200)
    if (error) fail(error, 'Failed to read custom fields')
    return ((data ?? []) as DefinitionRow[]).map(toField)
  }

  async define(
    ctx: TenancyContext,
    input: {
      entity: CustomFieldEntity
      key: string
      label: string
      type: CustomFieldType
      choices: string[] | null
      formula: string | null
      required: boolean
    },
  ): Promise<CustomField> {
    const existing = await this.definitions(ctx, input.entity)
    if (existing.length >= MAX_FIELDS_PER_ENTITY)
      throw new ValidationError('CUSTOM_FIELD_LIMIT_REACHED')

    let choices: string[] | null = null
    if (input.type === 'choice') {
      choices = [...new Set((input.choices ?? []).map((choice) => choice.trim()).filter(Boolean))]
      if (choices.length === 0) throw new ValidationError('CUSTOM_FIELD_CHOICES_REQUIRED')
    }

    let formula: string | null = null
    if (input.type === 'formula') {
      formula = (input.formula ?? '').trim()
      const parsed = parseFormula(formula, formulaInputs(existing))
      if (!parsed.ok) throw new ValidationError(`CUSTOM_FIELD_FORMULA_${parsed.code}`)
    }

    const { data, error } = await supabase
      .from('custom_field_definitions')
      .insert({
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        entity_type: input.entity,
        key: input.key,
        label: input.label.trim(),
        field_type: input.type,
        choices,
        formula,
        // Nobody types a formula, so it cannot be required.
        is_required: input.type === 'formula' ? false : input.required,
      })
      .select(COLUMNS)
      .single()
    if (error) {
      // The key is unique for the life of the workspace, retired fields included.
      if (error.code === '23505') throw new ConflictError('CUSTOM_FIELD_KEY_TAKEN')
      fail(error, 'Failed to save the custom field')
    }
    return toField(data as DefinitionRow)
  }

  /** Retire or bring back. Never a delete; the entered values stay. */
  async setActive(ctx: TenancyContext, id: string, isActive: boolean): Promise<CustomField> {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select(COLUMNS)
      .maybeSingle()
    if (error) fail(error, 'Failed to update the custom field')
    if (!data) throw new NotFoundError('Custom field')
    return toField(data as DefinitionRow)
  }

  private async assertOwned(ctx: TenancyContext, entity: CustomFieldEntity, entityId: string) {
    const { data, error } = await supabase
      .from(CUSTOM_FIELD_ENTITIES[entity])
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', entityId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the record', error)
    if (!data) throw new NotFoundError('Record')
  }

  private async stored(ctx: TenancyContext, entity: CustomFieldEntity, entityId: string) {
    const { data, error } = await supabase
      .from('custom_field_values')
      .select('field_values')
      .eq('workspace_id', ctx.workspaceId)
      .eq('entity_type', entity)
      .eq('entity_id', entityId)
      .maybeSingle()
    if (error) fail(error, 'Failed to read custom field values')
    return ((data as { field_values?: Record<string, StoredValue> } | null)?.field_values ??
      {}) as Record<string, StoredValue>
  }

  private shape(fields: CustomField[], stored: Record<string, StoredValue>): CustomFieldRecord {
    const values: Record<string, StoredValue> = {}
    for (const field of fields) {
      if (field.type !== 'formula') values[field.key] = stored[field.key] ?? null
    }
    const inputs = formulaInputs(fields)
    const computed: CustomFieldRecord['computed'] = {}
    for (const field of fields) {
      if (field.type !== 'formula') continue
      const parsed = parseFormula(field.formula ?? '', inputs)
      // A formula can stop parsing later — the field it names was retired. That
      // is said, not hidden.
      if (!parsed.ok) {
        computed[field.key] = { ok: false, code: parsed.code }
        continue
      }
      const result = evaluateFormula(parsed.tokens, values)
      computed[field.key] = result.ok
        ? { ok: true, value: result.value }
        : { ok: false, code: result.code }
    }
    return { fields, values, computed }
  }

  async read(
    ctx: TenancyContext,
    entity: CustomFieldEntity,
    entityId: string,
  ): Promise<CustomFieldRecord> {
    await this.assertOwned(ctx, entity, entityId)
    const fields = await this.definitions(ctx, entity)
    if (fields.length === 0) return { fields, values: {}, computed: {} }
    return this.shape(fields, await this.stored(ctx, entity, entityId))
  }

  async write(
    ctx: TenancyContext,
    entity: CustomFieldEntity,
    entityId: string,
    incoming: Record<string, unknown>,
  ): Promise<CustomFieldRecord> {
    await this.assertOwned(ctx, entity, entityId)
    const fields = await this.definitions(ctx, entity)
    const byKey = new Map(fields.map((field) => [field.key, field]))

    for (const key of Object.keys(incoming)) {
      const field = byKey.get(key)
      if (!field) throw new ValidationError('CUSTOM_FIELD_UNKNOWN')
      if (field.type === 'formula') throw new ValidationError('CUSTOM_FIELD_FORMULA_NOT_WRITABLE')
    }

    // Values of retired fields are kept as they are; active ones are replaced
    // by what was sent, each checked against its definition.
    const previous = await this.stored(ctx, entity, entityId)
    const next: Record<string, StoredValue> = { ...previous }
    for (const field of fields) {
      if (field.type === 'formula') continue
      const raw = field.key in incoming ? incoming[field.key] : (previous[field.key] ?? null)
      const value = this.coerce(field, raw)
      if (value === null && field.required)
        throw new ValidationError(`CUSTOM_FIELD_REQUIRED:${field.key}`)
      next[field.key] = value
    }

    const { error } = await supabase.from('custom_field_values').upsert(
      {
        workspace_id: ctx.workspaceId,
        entity_type: entity,
        entity_id: entityId,
        field_values: next,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,entity_type,entity_id' },
    )
    if (error) fail(error, 'Failed to save custom field values')
    return this.shape(fields, next)
  }

  /** One value, checked against its field. Empty is null — never '' and never 0. */
  private coerce(field: CustomField, raw: unknown): StoredValue {
    if (raw === null || raw === undefined || raw === '') return null
    const bad = () => new ValidationError(`CUSTOM_FIELD_INVALID:${field.key}`)
    switch (field.type) {
      case 'text': {
        if (typeof raw !== 'string') throw bad()
        const text = raw.trim()
        if (text.length > 500) throw bad()
        return text === '' ? null : text
      }
      case 'number': {
        const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
        if (!Number.isFinite(value)) throw bad()
        return value
      }
      case 'boolean':
        if (typeof raw !== 'boolean') throw bad()
        return raw
      case 'date':
        if (typeof raw !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(raw)) throw bad()
        return raw
      case 'choice':
        if (typeof raw !== 'string' || !(field.choices ?? []).includes(raw)) throw bad()
        return raw
      default:
        throw bad()
    }
  }
}

export const customFieldsService = new CustomFieldsService()
