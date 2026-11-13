// ============================================
// backend/src/__tests__/ai-usage-01.pg.test.ts
//
// V63 · A — docs/ai-usage-01-migration.sql on a real PostgreSQL:
//
//  1. applies TWICE (idempotent);
//  2. the prompt history is written by a trigger and cannot be edited;
//  3. tokens are NULL unless every row reported them;
//  4. cost is NULL when the model has no price, and exact when it has one;
//  5. the unique indexes and scope rules refuse the writes they must refuse.
//
// The two tables the migration alters/attaches to (ai_query_log,
// ai_provider_settings) are created here in their smallest real shape: this
// suite tests THIS migration, not T13 or Phase O.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { freePortSync } from './helpers/free-port'
import { pgTempDir } from './helpers/pg-temp-dir'

const PORT = freePortSync()
const dir = pgTempDir('hisabche-pg-ai-usage-')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  port: PORT,
  user: 'postgres',
  password: 'test',
  persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
})
const url = `postgres://postgres:test@localhost:${PORT}/aiadmin`
let sql: postgres.Sql

const migration = readFileSync(join(__dirname, '../../../docs/ai-usage-01-migration.sql'), 'utf-8')

const PREREQUISITES = `
CREATE TABLE IF NOT EXISTS public.ai_query_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  actor_id uuid,
  question_text text NOT NULL,
  resolved_views_or_functions text[],
  answer_text text,
  model_provider text,
  model_name text,
  latency_ms integer,
  was_flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_provider_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  provider text NOT NULL DEFAULT 'anthropic',
  base_url text,
  model text NOT NULL DEFAULT 'claude-sonnet-4-5',
  api_key text,
  system_prompt text NOT NULL DEFAULT '',
  topup_contact text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
`

describe('ai-usage-01-migration.sql', () => {
  beforeAll(async () => {
    await pg.initialise()
    await pg.start()
    const root = postgres(`postgres://postgres:test@localhost:${PORT}/postgres`)
    await root`CREATE DATABASE aiadmin`
    await root.end()
    sql = postgres(url)
    await sql.unsafe(PREREQUISITES)
  }, 60_000)

  afterAll(async () => {
    if (sql) await sql.end({ timeout: 2 })
    try {
      await pg.stop()
    } catch {
      // ignore
    }
  })

  it('applies twice without error (idempotent)', async () => {
    await sql.unsafe(migration)
    await expect(sql.unsafe(migration)).resolves.toBeDefined()
  })

  it('writes a prompt version from the settings row, and only when the prompt changed', async () => {
    await sql`
      INSERT INTO public.ai_provider_settings (provider, system_prompt)
      VALUES ('anthropic', 'first prompt')
    `
    await sql`UPDATE public.ai_provider_settings SET is_enabled = true`
    await sql`UPDATE public.ai_provider_settings SET system_prompt = 'second prompt'`

    const rows = await sql<{ content: string }[]>`
      SELECT content FROM public.ai_prompt_versions ORDER BY version ASC
    `
    expect(rows.map((row) => row.content)).toEqual(['first prompt', 'second prompt'])
  })

  it('refuses an UPDATE and a DELETE of a prompt version', async () => {
    await expect(
      sql`UPDATE public.ai_prompt_versions SET content = 'rewritten' WHERE version = 1`,
    ).rejects.toThrow(/append-only/i)
    await expect(sql`DELETE FROM public.ai_prompt_versions WHERE version = 1`).rejects.toThrow(
      /append-only/i,
    )
  })

  it('reports tokens as NULL unless every row in the group reported them', async () => {
    await sql`
      INSERT INTO public.ai_query_log
        (workspace_id, question_text, model_provider, model_name, prompt_tokens, completion_tokens, created_at)
      VALUES
        ('00000000-0000-0000-0000-000000000001', 'q1', 'anthropic', 'claude-x', 10, 20, '2026-03-02T10:00:00Z'),
        ('00000000-0000-0000-0000-000000000001', 'q2', 'anthropic', 'claude-x', NULL, NULL, '2026-03-02T11:00:00Z')
    `
    const rows = await sql<
      {
        prompt_tokens: string | null
        completion_tokens: string | null
        cost_micros: string | null
      }[]
    >`SELECT * FROM public.ai_usage_summary('2026-03-01T00:00:00Z', '2026-04-01T00:00:00Z')`

    expect(rows).toHaveLength(1)
    // One row of two reported nothing, so the total is unknown — not 10.
    expect(rows[0]?.prompt_tokens).toBeNull()
    expect(rows[0]?.completion_tokens).toBeNull()
    expect(rows[0]?.cost_micros).toBeNull()
  })

  it('leaves cost NULL when the model has no price, then computes it exactly', async () => {
    await sql`
      INSERT INTO public.ai_query_log
        (workspace_id, question_text, model_provider, model_name, prompt_tokens, completion_tokens, created_at)
      VALUES
        ('00000000-0000-0000-0000-000000000002', 'q3', 'openai', 'gpt-x', 1000000, 500000, '2026-03-03T10:00:00Z')
    `
    const unpriced = await sql<
      { currency: string | null; cost_micros: string | null; unpriced_queries: string }[]
    >`
      SELECT currency, cost_micros, unpriced_queries
        FROM public.ai_usage_summary('2026-03-03T00:00:00Z', '2026-03-04T00:00:00Z')
    `
    expect(unpriced).toHaveLength(1)
    expect(unpriced[0]?.currency).toBeNull()
    expect(unpriced[0]?.cost_micros).toBeNull()
    expect(unpriced[0]?.unpriced_queries).toBe('1')

    await sql`
      INSERT INTO public.ai_model_prices
        (provider, model, currency, input_micros_per_million, output_micros_per_million)
      VALUES ('openai', 'gpt-x', 'USD', 3000000, 6000000)
    `
    const priced = await sql<{ currency: string; cost_micros: string }[]>`
      SELECT currency, cost_micros
        FROM public.ai_usage_summary('2026-03-03T00:00:00Z', '2026-03-04T00:00:00Z')
    `
    // 1,000,000 × 3,000,000 / 1,000,000 = 3,000,000
    //   500,000 × 6,000,000 / 1,000,000 = 3,000,000
    expect(priced[0]?.currency).toBe('USD')
    expect(priced[0]?.cost_micros).toBe('6000000')
  })

  it('never adds two currencies together: a budget is per currency', async () => {
    await sql`
      INSERT INTO public.ai_budgets (scope, currency, monthly_limit_micros)
      VALUES ('platform', 'USD', 10000000), ('platform', 'AFN', 500000000)
    `
    const rows = await sql<{ currency: string }[]>`
      SELECT currency FROM public.ai_budgets WHERE scope = 'platform' ORDER BY currency
    `
    expect(rows.map((row) => row.currency)).toEqual(['AFN', 'USD'])

    await expect(
      sql`INSERT INTO public.ai_budgets (scope, currency, monthly_limit_micros)
          VALUES ('platform', 'USD', 20000000)`,
    ).rejects.toThrow(/duplicate key|ux_ai_budgets_platform/i)
  })

  it('refuses a workspace budget without a workspace, and a zero ceiling', async () => {
    await expect(
      sql`INSERT INTO public.ai_budgets (scope, currency, monthly_limit_micros)
          VALUES ('workspace', 'USD', 1000)`,
    ).rejects.toThrow(/ai_budgets_scope_workspace|check constraint/i)

    await expect(
      sql`INSERT INTO public.ai_budgets (scope, workspace_id, currency, monthly_limit_micros)
          VALUES ('workspace', '00000000-0000-0000-0000-000000000003', 'USD', 0)`,
    ).rejects.toThrow(/check constraint/i)
  })

  it('refuses a duplicate fallback position and a malformed currency', async () => {
    await sql`
      INSERT INTO public.ai_provider_fallbacks (position, provider, model)
      VALUES (1, 'openai', 'gpt-x')
    `
    await expect(
      sql`INSERT INTO public.ai_provider_fallbacks (position, provider, model)
          VALUES (1, 'anthropic', 'claude-x')`,
    ).rejects.toThrow(/duplicate key|ux_ai_provider_fallbacks_position/i)

    await expect(
      sql`INSERT INTO public.ai_model_prices
            (provider, model, currency, input_micros_per_million, output_micros_per_million)
          VALUES ('openai', 'gpt-y', 'usd', 1, 1)`,
    ).rejects.toThrow(/check constraint/i)
  })

  it('replaces the whole fallback list in one call', async () => {
    const replaced = await sql<{ ai_fallbacks_replace: number }[]>`
      SELECT public.ai_fallbacks_replace(
        '[{"position":1,"provider":"anthropic","model":"claude-y","timeoutMs":30000,"isEnabled":true},
          {"position":2,"provider":"openai","model":"gpt-z","baseUrl":"https://openrouter.ai/api/v1","timeoutMs":45000,"isEnabled":false}]'::jsonb,
        'owner@hisabche.com'
      )
    `
    expect(replaced[0]?.ai_fallbacks_replace).toBe(2)

    const rows = await sql<
      { position: number; model: string; timeout_ms: number; is_enabled: boolean }[]
    >`
      SELECT position, model, timeout_ms, is_enabled
        FROM public.ai_provider_fallbacks ORDER BY position
    `
    expect(rows).toEqual([
      { position: 1, model: 'claude-y', timeout_ms: 30000, is_enabled: true },
      { position: 2, model: 'gpt-z', timeout_ms: 45000, is_enabled: false },
    ])

    await expect(sql`SELECT public.ai_fallbacks_replace('{}'::jsonb, 'x')`).rejects.toThrow(
      /AI_FALLBACKS_INVALID/,
    )
  })

  it('upserts one ceiling per currency through the database function', async () => {
    await sql`SELECT public.ai_budget_save('platform', NULL, 'USD', 25000000, 90, 'ops@hisabche.com')`
    const updated = await sql<{ monthly_limit_micros: string; alert_percent: number }[]>`
      SELECT monthly_limit_micros, alert_percent FROM public.ai_budgets
       WHERE scope = 'platform' AND currency = 'USD'
    `
    // The earlier insert created the row; this call must UPDATE it, not add a
    // second ceiling for the same currency.
    expect(updated).toHaveLength(1)
    expect(updated[0]?.monthly_limit_micros).toBe('25000000')
    expect(updated[0]?.alert_percent).toBe(90)

    const workspace = await sql<{ ai_budget_save: string }[]>`
      SELECT public.ai_budget_save(
        'workspace',
        '00000000-0000-0000-0000-000000000004'::uuid,
        'AFN', 500000000, 75, 'owner@hisabche.com'
      )
    `
    expect(workspace[0]?.ai_budget_save).toBeTruthy()
  })

  it('enables RLS on every new table', async () => {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT c.relname, c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname IN ('ai_provider_fallbacks', 'ai_model_prices', 'ai_budgets', 'ai_prompt_versions')
       ORDER BY c.relname
    `
    expect(rows).toHaveLength(4)
    for (const row of rows) expect(row.relrowsecurity, row.relname).toBe(true)
  })
})
