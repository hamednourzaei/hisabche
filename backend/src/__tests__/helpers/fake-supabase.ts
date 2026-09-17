// ============================================
// backend/src/__tests__/helpers/fake-supabase.ts
//
// An in-memory stand-in for the PostgREST query builder, so integration tests
// can drive REAL HTTP through the real routes, the real guards and the real
// services, and then read back the rows that were actually written.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS FOR, AND WHAT IT IS NOT
//
// It exists because the domain suites never touch a database and therefore
// cannot see: a route that forgot a guard, a service that wrote to the wrong
// workspace, an idempotency key that does not actually deduplicate, or two
// concurrent requests that both succeed when only one should.
//
// It is NOT a Postgres. It does not enforce RLS, foreign keys, constraints or
// transactions, and a test passing here is not evidence that the SQL is right.
// Row Level Security is a database feature and can only be proven against a
// database — `scripts/verify-rls.mjs` is where that belongs, and this file
// does not pretend to replace it.
//
// ---------------------------------------------------------------------------
// UNSUPPORTED OPERATIONS THROW
//
// Deliberately. A fake that silently returns `[]` for a filter it does not
// understand turns a real defect into a passing test — the exact failure this
// harness was built to catch. If a service uses something not implemented
// here, the test fails loudly and this file grows.
// ============================================

export type Row = Record<string, any>

type Filter = (row: Row) => boolean

/**
 * A column, or a dotted path into an embedded resource (`journal_entries.date`
 * on a row seeded with a nested `journal_entries` object) — how PostgREST
 * filters on an `!inner` embed.
 */
function valueAt(row: Row, column: string): any {
  if (column in row) return row[column]
  const [head, ...rest] = column.split('.')
  if (!head || rest.length === 0) return undefined
  const nested = row[head]
  const target = Array.isArray(nested) ? nested[0] : nested
  return target == null ? undefined : valueAt(target, rest.join('.'))
}

interface OrderSpec {
  column: string
  ascending: boolean
}

/** A uniqueness rule, so `onConflict` can behave like a real upsert. */
export interface UniqueIndex {
  table: string
  columns: string[]
}

export class FakeDatabase {
  readonly tables = new Map<string, Row[]>()
  readonly uniques: UniqueIndex[] = []
  readonly rpcs = new Map<string, (args: Row) => unknown>()

  /**
   * PostgREST's `max-rows`. When set, every select returns at most this many
   * rows whatever `.limit()` asked for — silently, exactly like production.
   * `null` (the default) keeps the older suites unchanged.
   */
  maxRows: number | null = null

  /** Tables whose selects fail, so a test can prove an error is not swallowed. */
  readonly failures = new Map<string, { code?: string; message: string }>()

  fail(table: string, error: { code?: string; message: string }) {
    this.failures.set(table, error)
    return this
  }

  /** Every query that ran, in order. Lets a test assert on tenant scoping. */
  readonly queries: Array<{ table: string; op: string; filters: string[] }> = []

  seed(table: string, rows: Row[]) {
    this.tables.set(table, [...(this.tables.get(table) ?? []), ...rows.map((row) => ({ ...row }))])
    return this
  }

  unique(table: string, columns: string[]) {
    this.uniques.push({ table, columns })
    return this
  }

  rpc(name: string, handler: (args: Row) => unknown) {
    this.rpcs.set(name, handler)
    return this
  }

  rows(table: string): Row[] {
    return this.tables.get(table) ?? []
  }

  private ensure(table: string): Row[] {
    let rows = this.tables.get(table)
    if (!rows) {
      rows = []
      this.tables.set(table, rows)
    }
    return rows
  }

  /** The one entry point the services see. */
  from(table: string) {
    return new QueryBuilder(this, this.ensure(table), table)
  }

  callRpc(name: string, args: Row) {
    const handler = this.rpcs.get(name)
    if (!handler) {
      // The code real PostgREST returns for a function that does not exist, so
      // a service's «not installed yet» fallback behaves here as in production.
      return {
        data: null,
        error: { code: 'PGRST202', message: `RPC ${name} is not registered in the fake` },
      }
    }

    try {
      return { data: handler(args ?? {}), error: null }
    } catch (err) {
      // Services parse a SCREAMING_CASE code out of the message, exactly as
      // they do with a real `RAISE EXCEPTION`. Preserving that shape is what
      // makes the conflict paths testable at all.
      return { data: null, error: { message: (err as Error).message } }
    }
  }
}

let idCounter = 0

/**
 * A deterministic id in real UUID SHAPE.
 *
 * It has to be a valid uuid, not a readable label: the zod schemas on the
 * routes use `uuidSchema`, so an id like `account-00000001` is rejected at the
 * boundary and the test never reaches the code it is about — which looks
 * exactly like a validation bug in the service.
 *
 * The prefix survives as a hex-encoded tag in the first block, so a row is
 * still traceable to what created it while remaining a legal uuid.
 */
export function fakeId(prefix = 'row'): string {
  idCounter += 1

  const tag = [...prefix]
    .map((character) => character.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 8)
    .padEnd(8, '0')

  const counter = String(idCounter).padStart(12, '0')

  // Version 4 nibble and a valid variant, so anything that inspects the shape
  // rather than just the format still sees a well-formed uuid.
  return `${tag}-0000-4000-8000-${counter}`
}

class QueryBuilder implements PromiseLike<{ data: any; error: any }> {
  private filters: Filter[] = []
  private describedFilters: string[] = []
  private orderSpecs: OrderSpec[] = []
  private limitCount: number | null = null
  private rangeFrom = 0
  private mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: Row[] = []
  private conflictColumns: string[] | null = null
  private ignoreDuplicates = false
  private returning = false
  private singleMode: 'one' | 'maybe' | null = null
  private countMode: string | null = null

  constructor(
    private readonly db: FakeDatabase,
    private readonly store: Row[],
    private readonly table: string,
  ) {}

  // ─── Projection ───────────────────────────────────────────────────────────

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (this.mode === 'select') this.mode = 'select'
    else this.returning = true
    if (options?.count) this.countMode = options.count
    return this
  }

  // ─── Writes ───────────────────────────────────────────────────────────────

  insert(values: Row | Row[]) {
    this.mode = 'insert'
    this.payload = Array.isArray(values) ? values : [values]
    return this
  }

  upsert(values: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.mode = 'upsert'
    this.payload = Array.isArray(values) ? values : [values]
    this.conflictColumns = options?.onConflict
      ? options.onConflict.split(',').map((column) => column.trim())
      : null
    this.ignoreDuplicates = options?.ignoreDuplicates ?? false
    return this
  }

  update(values: Row) {
    this.mode = 'update'
    this.payload = [values]
    return this
  }

  delete() {
    this.mode = 'delete'
    return this
  }

  // ─── Filters ──────────────────────────────────────────────────────────────

  private push(description: string, filter: Filter) {
    this.describedFilters.push(description)
    this.filters.push(filter)
    return this
  }

  eq(column: string, value: unknown) {
    return this.push(`eq:${column}`, (row) => valueAt(row, column) === value)
  }

  neq(column: string, value: unknown) {
    return this.push(`neq:${column}`, (row) => valueAt(row, column) !== value)
  }

  gt(column: string, value: any) {
    return this.push(`gt:${column}`, (row) => valueAt(row, column) > value)
  }

  gte(column: string, value: any) {
    return this.push(`gte:${column}`, (row) => valueAt(row, column) >= value)
  }

  lt(column: string, value: any) {
    return this.push(`lt:${column}`, (row) => valueAt(row, column) < value)
  }

  lte(column: string, value: any) {
    return this.push(`lte:${column}`, (row) => valueAt(row, column) <= value)
  }

  /**
   * `is` is NOT `eq`.
   *
   * `.eq('deleted_at', null)` matches nothing in PostgREST, which is how
   * `listWarehouses` came to always return empty. The fake keeps the two
   * distinct so that bug would fail here too.
   */
  is(column: string, value: null | boolean) {
    return this.push(`is:${column}`, (row) =>
      value === null ? valueAt(row, column) == null : valueAt(row, column) === value,
    )
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values)
    return this.push(`in:${column}`, (row) => set.has(valueAt(row, column)))
  }

  /**
   * Only `col.is.null` and `col.neq.value`, comma-separated — what the code
   * uses. PostgREST semantics: neq on NULL is not a match.
   */
  or(filter: string) {
    const parts = filter.split(',').map((part) => {
      const [column, operator, ...rest] = part.split('.')
      const value = rest.join('.')
      if (operator === 'is' && value === 'null')
        return (row: Record<string, unknown>) => valueAt(row, column!) == null
      if (operator === 'neq') {
        return (row: Record<string, unknown>) => {
          const cell = valueAt(row, column!)
          return cell != null && String(cell) !== value
        }
      }
      throw new Error(`fake-supabase: .or(${part}) is not implemented`)
    })
    return this.push(`or:${filter}`, (row) => parts.some((test) => test(row)))
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === 'in') {
      // '("paid","cancelled")' → NOT IN; a NULL cell is not a match, as in SQL.
      const values = String(value)
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map((item) => item.trim().replace(/^"|"$/g, ''))
      return this.push(`not.in:${column}`, (row) => {
        const cell = valueAt(row, column)
        return cell != null && !values.includes(String(cell))
      })
    }
    if (operator !== 'is') {
      throw new Error(`fake-supabase: .not(${operator}) is not implemented`)
    }
    return this.push(`not.is:${column}`, (row) =>
      value === null ? valueAt(row, column) != null : valueAt(row, column) !== value,
    )
  }

  like(column: string, pattern: string) {
    const regex = new RegExp(`^${pattern.replace(/%/g, '.*')}$`)
    return this.push(`like:${column}`, (row) => regex.test(String(valueAt(row, column) ?? '')))
  }

  ilike(column: string, pattern: string) {
    const regex = new RegExp(`^${pattern.replace(/%/g, '.*')}$`, 'i')
    return this.push(`ilike:${column}`, (row) => regex.test(String(valueAt(row, column) ?? '')))
  }

  // ─── Shaping ──────────────────────────────────────────────────────────────

  order(column: string, options?: { ascending?: boolean }) {
    this.orderSpecs.push({ column, ascending: options?.ascending ?? true })
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  range(from: number, to: number) {
    this.rangeFrom = from
    this.limitCount = to - from + 1
    return this
  }

  maybeSingle() {
    this.singleMode = 'maybe'
    return this
  }

  // ─── Execution ────────────────────────────────────────────────────────────

  private matching(): Row[] {
    return this.store.filter((row) => this.filters.every((filter) => filter(row)))
  }

  private conflictKey(row: Row, columns: string[]): string {
    return columns.map((column) => String(row[column])).join(' ')
  }

  private run(): { data: any; error: any } {
    this.db.queries.push({
      table: this.table,
      op: this.mode,
      filters: [...this.describedFilters],
    })

    let result: Row[] = []

    if (this.mode === 'select') {
      const failure = this.db.failures.get(this.table)
      if (failure) return { data: null, error: failure }

      result = this.matching()

      if (this.orderSpecs.length > 0) {
        result = [...result].sort((a, b) => {
          for (const { column, ascending } of this.orderSpecs) {
            const left = valueAt(a, column)
            const right = valueAt(b, column)
            if (left === right) continue
            return (left > right ? 1 : -1) * (ascending ? 1 : -1)
          }
          return 0
        })
      }

      const cap = [this.limitCount, this.db.maxRows].filter((n): n is number => n != null)
      const count = cap.length > 0 ? Math.min(...cap) : result.length
      result = result.slice(this.rangeFrom, this.rangeFrom + count)
    }

    if (this.mode === 'insert' || this.mode === 'upsert') {
      const written: Row[] = []

      for (const value of this.payload) {
        const row: Row = { id: value.id ?? fakeId(this.table), ...value }

        const columns =
          this.conflictColumns ??
          this.db.uniques.find((index) => index.table === this.table)?.columns ??
          null

        if (columns) {
          const key = this.conflictKey(row, columns)
          const existing = this.store.find(
            (candidate) => this.conflictKey(candidate, columns) === key,
          )

          if (existing) {
            if (this.mode === 'insert') {
              // A real unique violation, with the code services look for.
              return {
                data: null,
                error: { code: '23505', message: `duplicate key value violates unique constraint` },
              }
            }

            if (!this.ignoreDuplicates) Object.assign(existing, value)
            written.push(existing)
            continue
          }
        }

        this.store.push(row)
        written.push(row)
      }

      result = written
    }

    if (this.mode === 'update') {
      const target = this.matching()
      for (const row of target) Object.assign(row, this.payload[0])
      result = target
    }

    if (this.mode === 'delete') {
      const target = this.matching()
      for (const row of target) {
        const index = this.store.indexOf(row)
        if (index >= 0) this.store.splice(index, 1)
      }
      result = target
    }

    const data = result.map((row) => ({ ...row }))

    if (this.singleMode === 'maybe') {
      return { data: data[0] ?? null, error: null, count: data.length } as any
    }

    if (this.singleMode === 'one') {
      if (data.length !== 1) {
        return {
          data: null,
          // PGRST116 is what PostgREST returns when `.single()` matches none.
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
          },
        } as any
      }
      return { data: data[0], error: null } as any
    }

    return { data, error: null, count: this.countMode ? data.length : undefined } as any
  }

  /** Both a modifier and a terminator: it resolves immediately. */
  async single() {
    this.singleMode = 'one'
    return this.run()
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected)
    } catch (err) {
      return Promise.reject(err).then(onfulfilled, onrejected)
    }
  }
}

/** The module shape `src/db.ts` exports, backed by the fake. */
export function createFakeDb(db: FakeDatabase, users: Map<string, { id: string }>) {
  const supabase = {
    auth: {
      getUser: async (token: string) => {
        const user = users.get(token)
        return user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: 'invalid token' } }
      },
    },
    from: (table: string) => db.from(table),
    rpc: async (name: string, args: Row) => db.callRpc(name, args),
  }

  return {
    supabase,
    default: supabase,
    checkDatabaseConnection: async () => true,
    dbStats: { queries: 0, errors: 0 },
    withConnection: async <T>(fn: () => Promise<T>) => fn(),
  }
}
