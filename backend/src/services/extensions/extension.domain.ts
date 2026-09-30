// ============================================
// Capabilities #141, #142, #143 — custom objects, fields and formulas.
// Engine N7.
//
// ⚠️ THIS IS THE MOST DANGEROUS ENGINE IN THE PRODUCT, AND THE BOUNDARY IS
// THE WHOLE DESIGN.
//
// The temptation is to make the database dynamic: an EAV table, or a JSONB
// column on every table, so a shop can attach whatever field it wants. That
// would make `invoice.total` mean something different in two workspaces, and
// every rule in this codebase — the tax engine, the ledger, the costing core,
// the period lock — would have to handle a shape it cannot assume. That is how a
// bookkeeping system becomes one where nobody can trust the books.
//
// So the extension layer is EXPLICITLY OUTSIDE the financial core:
//
//   * it attaches to a CLOSED list of extensible entities, and no financial
//     table is on it
//   * it never changes a column, a type, a constraint or a trigger
//   * a field's values live in ONE table, addressed by (workspace, object,
//     entity, record)
//   * a formula reads fields, it does not execute anything
//
// ⚠️ AND A FORMULA IS AN EXPRESSION OVER VALUES, NOT A PROGRAM.
//
// `rules.domain.ts` already says the same about rules — «a rule produces a
// DECISION, it never performs one» — and a formula field that could call a
// function is a formula field that can run code in the database. The operator
// set here is closed and total on its declared inputs: no user functions, no
// network, no recursion.
//
// ⚠️ WHY A FORMULA NEEDS A SCOPE AT ALL.
//
// A formula that reads another workspace's field is a cross-tenant read wearing
// a spreadsheet's clothes. Every field a formula names is resolved inside its own
// workspace, and a name it cannot resolve is a compile error — not an empty
// string, which would silently make every dependent calculation zero.
export type ExtensionFieldType = 'text' | 'number' | 'money' | 'date' | 'boolean' | 'choice'

/** ⚠️ THE ENTITIES THAT MAY BE EXTENDED. Read it: no financial table is here. */
export type ExtensibleEntity = 'customer' | 'supplier' | 'product' | 'project' | 'task' | 'contact'

/**
 * ⚠️ WHAT MAY NOT BE EXTENDED, and why each one is named.
 *
 * This list is the guard's data, not a comment. `extension-guard.test.ts`
 * asserts that nothing financial appears in `EXTENSIBLE_ENTITIES`, so adding one
 * takes editing this list deliberately.
 */
export const NEVER_EXTENSIBLE: readonly { entity: string; why: string }[] = [
  { entity: 'invoices', why: 'a financial document; a custom total would be an unaudited one' },
  { entity: 'invoice_items', why: 'the line is what the ledger is built from' },
  { entity: 'journal_entries', why: 'the ledger is the one thing that is not extensible' },
  { entity: 'journal_lines', why: 'debit and credit are meanings, not fields' },
  { entity: 'accounts', why: 'an account IS the tax and posting machinery' },
  {
    entity: 'payments',
    why: 'it records money moving, and a custom field on it is an unaudited one',
  },
  {
    entity: 'payment_allocations',
    why: 'it is how a payment is attributed to an invoice; a custom column here changes what was paid against what',
  },
  { entity: 'cost_layers', why: 'the valuation reads it and assumes its shape' },
  { entity: 'stock_movements', why: 'the quantity is a projection of it' },
  {
    entity: 'products.quantity',
    why: 'a projection of the movement ledger; writing a custom value into it desynchronises stock from the movements that explain it',
  },
  {
    entity: 'subscriptions',
    why: 'billing state — a custom field here is invisible to every entitlement check',
  },
]

export interface FieldDefinition {
  key: string
  labelKey: string
  type: ExtensionFieldType
  /** For `choice`. Null otherwise, and null means no choices at all. */
  choices: readonly string[] | null
  required: boolean
  /** For `choice` with a default. */
  defaultValue?: string | number | boolean | null
}

export interface ObjectDefinition {
  /**
   * ⚠️ A NAME, not a table. `orders` is not a table in the database; it is a
   * grouping of custom fields on an extensible entity. Nothing in the schema
   * changes when it is created, which is the property that keeps the financial
   * core typed.
   */
  name: string
  extends: ExtensibleEntity
  fields: readonly FieldDefinition[]
}

// ─── Formula (#143) ─────────────────────────────────────────────────────────

export type FormulaOperator = '+' | '-' | '*' | '/' | 'min' | 'max' | 'sum' | 'count' | 'round'

/**
 * ⚠️ A CLOSED OPERATOR SET. No user functions, no method calls, no property
 * access beyond a field name, and nothing that can reach the network.
 *
 * A formula that could call a function is a formula that can run code in the
 * database, and this product already runs its arithmetic in SQL functions that
 * the ledger depends on. A dynamic one would be the same threat with less
 * documentation.
 */
const OPERATORS: readonly FormulaOperator[] = [
  '+',
  '-',
  '*',
  '/',
  'min',
  'max',
  'sum',
  'count',
  'round',
]

export type FormulaToken =
  | { kind: 'number'; value: number }
  | { kind: 'field'; key: string }
  | { kind: 'operator'; op: FormulaOperator }
  | { kind: 'open' }
  | { kind: 'close' }

export type FormulaResult =
  | { ok: true; tokens: FormulaToken[] }
  | {
      ok: false
      code: 'EMPTY' | 'UNKNOWN_OPERATOR' | 'UNKNOWN_FIELD' | 'UNBALANCED'
      detail: string
    }

/**
 * Parse a formula against the fields that actually exist.
 *
 * ⚠️ EVERY FAILURE NAMES ITSELF. A formula that silently evaluates to zero
 * turns every dependent report into a column of zeroes, and the shop has no way
 * to tell a broken formula from a business that stopped selling.
 */
export function parseFormula(
  source: string,
  availableFields: readonly FieldDefinition[],
): FormulaResult {
  const trimmed = source.trim()
  if (trimmed.length === 0) {
    return { ok: false, code: 'EMPTY', detail: 'a formula needs at least one term' }
  }

  const tokens: FormulaToken[] = []
  const known = new Set(availableFields.map((f) => f.key))
  let depth = 0

  // Numbers, field names, operators and parentheses, in that order — so
  // `1.5` is one number and not `1`, `.`, `5`.
  const pattern = /(\d+(?:\.\d+)?)|([a-zA-Z_][a-zA-Z0-9_]*)|([+\-*/])|(\()|(\))/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(trimmed)) !== null) {
    if (match[1] !== undefined) {
      tokens.push({ kind: 'number', value: Number(match[1]) })
      continue
    }

    if (match[2] !== undefined) {
      const name = match[2]
      if ((OPERATORS as readonly string[]).includes(name)) {
        tokens.push({ kind: 'operator', op: name as FormulaOperator })
        continue
      }
      if (!known.has(name)) {
        return {
          ok: false,
          code: 'UNKNOWN_FIELD',
          detail: `there is no field named "${name}" on this object`,
        }
      }
      tokens.push({ kind: 'field', key: name })
      continue
    }

    if (match[3] !== undefined) {
      tokens.push({ kind: 'operator', op: match[3] as FormulaOperator })
      continue
    }

    if (match[4] !== undefined) {
      depth += 1
      tokens.push({ kind: 'open' })
      continue
    }

    if (match[5] !== undefined) {
      depth -= 1
      if (depth < 0) {
        return { ok: false, code: 'UNBALANCED', detail: 'there is a ) with no (' }
      }
      tokens.push({ kind: 'close' })
    }
  }

  if (depth !== 0) {
    return { ok: false, code: 'UNBALANCED', detail: 'there is an unclosed (' }
  }

  return { ok: true, tokens }
}

export type EvaluationResult =
  | { ok: true; value: number }
  | { ok: false; code: 'MISSING_VALUE' | 'DIVIDE_BY_ZERO' | 'NOT_A_NUMBER'; detail: string }

/**
 * Evaluate a parsed formula against one record's values.
 *
 * ⚠️ EVERY FAILURE RETURNS, AND NONE OF THEM IS ZERO.
 *
 * The failure this prevents: a formula whose field is empty evaluates to 0, a
 * report shows a column of zeroes, and the shop concludes it made no money that
 * month. `MISSING_VALUE` is a different statement and it has to stay different
 * all the way to the screen.
 *
 * ⚠️ IMPLEMENTED AS THE ORDINARY SHUNTING YARD, because a hand-rolled
 * left-to-right fold gets `2 + 3 * 4` wrong. The first version did exactly that
 * and was replaced rather than patched: a formula field that computes
 * differently from the arithmetic the shopkeeper wrote it in is a field nobody
 * will trust twice.
 */
export function evaluateFormula(
  tokens: readonly FormulaToken[],
  values: Readonly<Record<string, number | string | boolean | null | undefined>>,
): EvaluationResult {
  const at = { index: 0 }

  const readValue = (): EvaluationResult => {
    const token = tokens[at.index]

    if (token?.kind === 'number') {
      at.index += 1
      return { ok: true, value: token.value }
    }

    if (token?.kind === 'field') {
      const raw = values[token.key]
      if (raw === null || raw === undefined || raw === '') {
        // ⚠️ NOT ZERO. A field nobody filled in is not a zero.
        return {
          ok: false,
          code: 'MISSING_VALUE',
          detail: `"${token.key}" has no value on this record`,
        }
      }
      const asNumber = typeof raw === 'boolean' ? (raw ? 1 : 0) : Number(raw)
      if (!Number.isFinite(asNumber)) {
        return { ok: false, code: 'NOT_A_NUMBER', detail: `"${token.key}" is not a number` }
      }
      at.index += 1
      return { ok: true, value: asNumber }
    }

    return { ok: false, code: 'NOT_A_NUMBER', detail: 'expected a value' }
  }

  /** Wraps an operator with parentheses: min(…), max(…), sum(…). */
  const readWrapped = (op: 'min' | 'max' | 'sum'): EvaluationResult => {
    at.index += 1 // the operator itself
    if (tokens[at.index]?.kind === 'open') at.index += 1

    let accumulated =
      op === 'max' ? Number.NEGATIVE_INFINITY : op === 'min' ? Number.POSITIVE_INFINITY : 0
    let count = 0

    while (at.index < tokens.length && tokens[at.index]?.kind !== 'close') {
      const value = readExpression()
      if (!value.ok) return value

      if (op === 'max') accumulated = Math.max(accumulated, value.value)
      else if (op === 'min') accumulated = Math.min(accumulated, value.value)
      else accumulated += value.value
      count += 1
    }

    if (tokens[at.index]?.kind === 'close') at.index += 1

    if (count === 0) {
      return { ok: false, code: 'MISSING_VALUE', detail: `${op}() was given nothing` }
    }
    return { ok: true, value: accumulated }
  }

  const readPower = (): EvaluationResult => {
    let left = readAtom()
    if (!left.ok) return left

    // ⚠️ THE TOKEN IS READ INTO A LOCAL before its `op` is used. Chaining
    // `tokens[at.index]!.op` after an optional-chained `.kind` check loses
    // the narrowing, so every use has to be a cast — and a cast is exactly
    // what let the first version of this evaluator compile while computing
    // `2 + 3 * 4` as 20.
    for (;;) {
      const token = tokens[at.index]
      if (!token || token.kind !== 'operator' || token.op !== '*') return left
      at.index += 1
      const right = readAtom()
      if (!right.ok) return right
      left = { ok: true, value: left.value * right.value }
    }
  }

  const readTerm = (): EvaluationResult => {
    let left = readPower()
    if (!left.ok) return left

    for (;;) {
      const token = tokens[at.index]
      if (!token || token.kind !== 'operator' || (token.op !== '/' && token.op !== '*')) return left

      const op = token.op
      at.index += 1
      const right = readPower()
      if (!right.ok) return right

      if (op === '/') {
        // ⚠️ NOT Infinity AND NOT ZERO. A division by an empty field is a
        // formula the shopkeeper has to fix.
        if (right.value === 0) {
          return { ok: false, code: 'DIVIDE_BY_ZERO', detail: 'the divisor is zero' }
        }
        left = { ok: true, value: left.value / right.value }
      } else {
        left = { ok: true, value: left.value * right.value }
      }
    }
  }

  const readExpression = (): EvaluationResult => {
    let left = readTerm()
    if (!left.ok) return left

    for (;;) {
      const token = tokens[at.index]
      if (!token || token.kind !== 'operator' || (token.op !== '+' && token.op !== '-')) return left

      const op = token.op
      at.index += 1
      const right = readTerm()
      if (!right.ok) return right
      left = { ok: true, value: op === '+' ? left.value + right.value : left.value - right.value }
    }
  }

  const readAtom = (): EvaluationResult => {
    const token = tokens[at.index]

    if (
      token?.kind === 'operator' &&
      (token.op === 'min' || token.op === 'max' || token.op === 'sum')
    ) {
      return readWrapped(token.op)
    }

    if (token?.kind === 'open') {
      at.index += 1
      const inner = readExpression()
      if (!inner.ok) return inner
      if (tokens[at.index]?.kind === 'close') at.index += 1
      return inner
    }

    return readValue()
  }

  const result = readExpression()
  if (!result.ok) return result

  // ⚠️ TRAILING TOKENS ARE AN ERROR, not a silent truncation. `a + b c` parses
  // to `a + b` and ignores `c` — a formula that quietly computes the wrong
  // thing.
  if (at.index < tokens.length) {
    return {
      ok: false,
      code: 'NOT_A_NUMBER',
      detail: 'there is something after the end of the expression',
    }
  }

  return result
}
