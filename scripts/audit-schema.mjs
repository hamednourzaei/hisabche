// ============================================================================
// scripts/audit-schema.mjs
//
// READ-ONLY schema audit. Runs no DDL and no writes — every statement below is
// a SELECT against information_schema / pg_catalog.
//
//     node scripts/audit-schema.mjs                  # human-readable
//     node scripts/audit-schema.mjs --json > s.json  # machine-checkable
//
// It exists because documents/DATABASE_SCHEMA.md has been wrong twice in ways
// that would have broken production: it claims `invoice_items` has no unit
// columns (it does) and that `invoices` has `workspace_id` (it does not). The
// migration is generated against THIS output, never against the doc.
//
// Reads SUPABASE_DATABASE_URL from backend/.env if not already in the env.
// ============================================================================

import { readFileSync } from 'node:fs'
import process from 'node:process'
import postgres from 'postgres'

const TABLES = [
  'invoices',
  'invoice_items',
  'invoice_item_details',
  'customers',
  'products',
  'transactions',
  'activities',
  'notifications',
  'workspaces',
  'workspace_members',
]

function connectionString() {
  if (process.env.SUPABASE_DATABASE_URL) return process.env.SUPABASE_DATABASE_URL

  try {
    const env = readFileSync(new URL('../backend/.env', import.meta.url), 'utf8')
    for (const line of env.split('\n')) {
      const match = line.match(/^\s*SUPABASE_DATABASE_URL\s*=\s*(.+)\s*$/)
      if (match) return match[1].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* fall through */
  }

  throw new Error(
    'SUPABASE_DATABASE_URL not set and not found in backend/.env.\n' +
      'Export it, or run the SQL in scripts/audit-schema.sql from the Supabase editor.',
  )
}

const sql = postgres(connectionString(), {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 15,
  // Belt and braces: this connection may not write, even by accident.
  connection: { options: '-c default_transaction_read_only=on' },
  onnotice: () => {},
})

const asJson = process.argv.includes('--json')
const report = { generatedAt: new Date().toISOString(), tables: {}, findings: [] }

function say(...args) {
  if (!asJson) console.log(...args)
}

try {
  // ── columns ──────────────────────────────────────────────────────────────
  const columns = await sql`
    SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ANY(${TABLES})
     ORDER BY table_name, ordinal_position
  `

  // ── constraints ──────────────────────────────────────────────────────────
  const constraints = await sql`
    SELECT tc.table_name, tc.constraint_type, tc.constraint_name,
           kcu.column_name,
           ccu.table_name  AS references_table,
           ccu.column_name AS references_column
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
             ON kcu.constraint_name = tc.constraint_name
            AND kcu.table_schema = tc.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
             ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
     WHERE tc.table_schema = 'public'
       AND tc.table_name = ANY(${TABLES})
       AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
     ORDER BY tc.table_name, tc.constraint_type
  `

  // ── indexes ──────────────────────────────────────────────────────────────
  const indexes = await sql`
    SELECT tablename AS table_name, indexname, indexdef
      FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = ANY(${TABLES})
     ORDER BY tablename, indexname
  `

  // ── triggers ─────────────────────────────────────────────────────────────
  const triggers = await sql`
    SELECT c.relname AS table_name, t.tgname AS trigger_name, p.proname AS function_name
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_proc  p ON p.oid = t.tgfoid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE NOT t.tgisinternal AND n.nspname = 'public' AND c.relname = ANY(${TABLES})
     ORDER BY c.relname, t.tgname
  `

  // ── RLS ──────────────────────────────────────────────────────────────────
  const rls = await sql`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
           (SELECT count(*) FROM pg_policies p
             WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = ANY(${TABLES})
     ORDER BY c.relname
  `

  // ── row counts (exact; these tables are small enough) ─────────────────────
  const counts = {}
  for (const table of TABLES) {
    try {
      const [row] = await sql`SELECT count(*)::bigint AS n FROM ${sql(table)}`
      counts[table] = Number(row.n)
    } catch {
      counts[table] = null // table absent
    }
  }

  // ── assemble ─────────────────────────────────────────────────────────────
  for (const table of TABLES) {
    const cols = columns.filter((c) => c.table_name === table)
    report.tables[table] = {
      exists: cols.length > 0,
      rowCount: counts[table],
      columns: cols.map((c) => ({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === 'YES',
        default: c.column_default,
      })),
      constraints: constraints
        .filter((c) => c.table_name === table)
        .map((c) => ({
          type: c.constraint_type,
          name: c.constraint_name,
          column: c.column_name,
          references: c.references_table ? `${c.references_table}.${c.references_column}` : null,
        })),
      indexes: indexes.filter((i) => i.table_name === table).map((i) => i.indexname),
      triggers: triggers
        .filter((t) => t.table_name === table)
        .map((t) => `${t.trigger_name} → ${t.function_name}`),
      rls: rls.find((r) => r.table_name === table) ?? null,
    }
  }

  // ── the findings that drive the migration ────────────────────────────────
  const SYNCED = ['invoices', 'customers', 'products', 'transactions']

  for (const table of SYNCED) {
    const t = report.tables[table]
    if (!t?.exists) {
      report.findings.push({ severity: 'error', table, finding: 'table does not exist' })
      continue
    }

    const names = t.columns.map((c) => c.name)
    report.findings.push({
      severity: names.includes('workspace_id') ? 'ok' : 'action-required',
      table,
      finding: names.includes('workspace_id')
        ? 'workspace_id present'
        : 'workspace_id MISSING — tenancy migration required',
      hasUserId: names.includes('user_id'),
      hasVersion: names.includes('version'),
      rowCount: t.rowCount,
    })
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    for (const table of TABLES) {
      const t = report.tables[table]
      if (!t.exists) {
        say(`\n── ${table}\n   ABSENT`)
        continue
      }
      say(`\n── ${table}  (${t.rowCount} rows)`)
      say(`   columns : ${t.columns.map((c) => c.name).join(', ')}`)
      say(
        `   pk/fk   : ${t.constraints.map((c) => `${c.type}:${c.column}${c.references ? '→' + c.references : ''}`).join('  ') || 'none'}`,
      )
      say(`   indexes : ${t.indexes.join(', ') || 'none'}`)
      say(`   triggers: ${t.triggers.join(', ') || 'none'}`)
      say(
        `   RLS     : ${t.rls?.rls_enabled ? `enabled, ${t.rls.policy_count} policies` : 'DISABLED'}`,
      )
    }

    say('\n════════ FINDINGS ════════')
    for (const f of report.findings) {
      say(
        `[${f.severity.toUpperCase()}] ${f.table}: ${f.finding}` +
          (f.rowCount != null ? `  (${f.rowCount} rows, user_id=${f.hasUserId})` : ''),
      )
    }
  }
} finally {
  await sql.end({ timeout: 5 })
}
