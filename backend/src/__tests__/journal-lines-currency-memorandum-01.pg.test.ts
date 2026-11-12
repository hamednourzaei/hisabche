import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { startPg, stopPg, type PgTestHandle } from './helpers/pg-test-harness'

describe('journal-lines-currency-memorandum-01-migration.sql (PG)', () => {
  let pg: PgTestHandle

  beforeAll(async () => {
    pg = await startPg()
    const baseSql = readFileSync(resolve(__dirname, '../../docs/base-schema-migration.sql'), 'utf8')
    const coreSql = readFileSync(
      resolve(__dirname, '../../docs/accounting-core-migration.sql'),
      'utf8',
    )
    const migSql = readFileSync(
      resolve(__dirname, '../../docs/journal-lines-currency-memorandum-01-migration.sql'),
      'utf8',
    )
    await pg.sql.unsafe(baseSql)
    await pg.sql.unsafe(coreSql)
    await pg.sql.unsafe(migSql)
    await pg.sql.unsafe(migSql)
  }, 60_000)

  afterAll(async () => {
    await stopPg(pg)
  })

  it('posts valid FX line, rejects mismatched FX rate, and refuses mixing memorandum with standard accounts', async () => {
    const ws1 = '11111111-1111-4111-8111-111111111111'
    const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const accCash = '10000000-0000-4000-8000-000000000001'
    const accRev = '10000000-0000-4000-8000-000000000002'
    const accMemo1 = '20000000-0000-4000-8000-000000000001'
    const accMemo2 = '20000000-0000-4000-8000-000000000002'

    await pg.sql`
      INSERT INTO public.accounts (id, workspace_id, user_id, code, name, type, kind, is_group, is_active)
      VALUES
        (${accCash}, ${ws1}, ${actor}, '1010', 'Cash', 'asset', 'standard', false, true),
        (${accRev}, ${ws1}, ${actor}, '4010', 'Revenue', 'revenue', 'standard', false, true),
        (${accMemo1}, ${ws1}, ${actor}, '9010', 'Guarantee Given', 'asset', 'memorandum', false, true),
        (${accMemo2}, ${ws1}, ${actor}, '9020', 'Guarantee Offset', 'liability', 'memorandum', false, true)
    `

    // Valid balanced FX entry: 100 USD * 70 AFN/USD = 7000 AFN
    const entry = {
      date: '2026-06-01',
      description: 'FX sale',
      reference: 'FX-1',
      status: 'posted',
    }
    const validLines = [
      {
        account_id: accCash,
        debit: 7000,
        credit: 0,
        currency: 'USD',
        amount_currency_minor: 10000,
        exchange_rate: 70,
      },
      {
        account_id: accRev,
        debit: 0,
        credit: 7000,
        currency: 'USD',
        amount_currency_minor: 10000,
        exchange_rate: 70,
      },
    ]
    const id = await pg.sql`
      SELECT public.accounting_post_journal_entry(${ws1}, ${actor}, ${pg.sql.json(entry)}, ${pg.sql.json(validLines)}) AS id
    `
    expect(id[0]?.id).toBeTruthy()

    // Rejected inconsistent FX rate
    const badFxLines = [
      {
        account_id: accCash,
        debit: 7000,
        credit: 0,
        currency: 'USD',
        amount_currency_minor: 10000,
        exchange_rate: 50,
      },
      { account_id: accRev, debit: 0, credit: 7000 },
    ]
    await expect(
      pg.sql`SELECT public.accounting_post_journal_entry(${ws1}, ${actor}, ${pg.sql.json(entry)}, ${pg.sql.json(badFxLines)})`,
    ).rejects.toThrow(/JOURNAL_LINE_FX_MISMATCH/)

    // Refuses mixing memorandum + standard
    const mixedLines = [
      { account_id: accMemo1, debit: 500, credit: 0 },
      { account_id: accCash, debit: 0, credit: 500 },
    ]
    await expect(
      pg.sql`SELECT public.accounting_post_journal_entry(${ws1}, ${actor}, ${pg.sql.json(entry)}, ${pg.sql.json(mixedLines)})`,
    ).rejects.toThrow(/JOURNAL_MEMORANDUM_MIXED_FORBIDDEN/)

    // Pure memorandum entry succeeds
    const memoLines = [
      { account_id: accMemo1, debit: 500, credit: 0 },
      { account_id: accMemo2, debit: 0, credit: 500 },
    ]
    const memoId = await pg.sql`
      SELECT public.accounting_post_journal_entry(${ws1}, ${actor}, ${pg.sql.json(entry)}, ${pg.sql.json(memoLines)}) AS id
    `
    expect(memoId[0]?.id).toBeTruthy()
  })
})
