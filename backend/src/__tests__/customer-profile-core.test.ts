// Customer 360 phase 3 — Customer Profile Core (credit limit, terms, linked
// supplier, documents). Pure rules plus the boundary guards.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  CustomerProfileError,
  MAX_DOCUMENT_BYTES,
  cleanFileName,
  combinedBalance,
  creditControl,
  customerInsights,
  matchDocumentEntries,
  isMissingSchema,
  validateDocument,
} from '../services/customer-profile'

const SRC = join(__dirname, '..')

describe('creditControl', () => {
  it('no limit configured → null (not "limit 0")', () => {
    expect(creditControl(500, null)).toBeNull()
  })

  it('a limit of 0 is real: any debt is over it', () => {
    expect(creditControl(1, 0)).toMatchObject({ overLimit: true, usedPercent: 100, available: -1 })
    expect(creditControl(0, 0)).toMatchObject({ overLimit: false, usedPercent: 0 })
  })

  it('uses the receivable; a credit balance uses nothing', () => {
    expect(creditControl(750, 1000)).toEqual({
      creditLimit: 1000,
      used: 750,
      available: 250,
      usedPercent: 75,
      overLimit: false,
    })
    expect(creditControl(-200, 1000)).toMatchObject({ used: 0, available: 1000 })
    expect(creditControl(1200, 1000)).toMatchObject({ overLimit: true, available: -200 })
  })
})

describe('combinedBalance', () => {
  it('nets what they owe us against what we owe them as supplier', () => {
    expect(combinedBalance(1000, 300)).toEqual({
      customerNet: 1000,
      supplierPayable: 300,
      net: 700,
    })
    expect(combinedBalance(100, 400).net).toBe(-300)
  })
})

describe('documents', () => {
  const b64 = (bytes: number) => Buffer.alloc(bytes, 1).toString('base64')

  it('accepts a pdf and reports the decoded size', () => {
    expect(
      validateDocument({
        fileName: 'a.pdf',
        mimeType: 'application/pdf',
        contentBase64: b64(1000),
      }),
    ).toBe(1000)
  })

  it('refuses other types, oversize, empty and non-base64', () => {
    const code = (fn: () => unknown) => {
      try {
        fn()
      } catch (err) {
        return (err as CustomerProfileError).code
      }
      return 'none'
    }
    expect(
      code(() =>
        validateDocument({ fileName: 'x.html', mimeType: 'text/html', contentBase64: b64(10) }),
      ),
    ).toBe('CUSTOMER_DOCUMENT_TYPE_NOT_ALLOWED')
    expect(
      code(() =>
        validateDocument({
          fileName: 'x.pdf',
          mimeType: 'application/pdf',
          contentBase64: b64(MAX_DOCUMENT_BYTES + 1),
        }),
      ),
    ).toBe('CUSTOMER_DOCUMENT_TOO_LARGE')
    expect(
      code(() =>
        validateDocument({ fileName: 'x.pdf', mimeType: 'application/pdf', contentBase64: '' }),
      ),
    ).toBe('CUSTOMER_DOCUMENT_EMPTY')
    expect(
      code(() =>
        validateDocument({
          fileName: 'x.pdf',
          mimeType: 'application/pdf',
          contentBase64: '<script>',
        }),
      ),
    ).toBe('CUSTOMER_DOCUMENT_BAD_CONTENT')
  })

  it('file names lose path separators and control characters', () => {
    expect(cleanFileName('../../etc/passwd')).toBe('....etcpasswd')
    expect(cleanFileName('a\\b' + String.fromCharCode(0) + 'c.pdf')).toBe('abc.pdf')
    expect(cleanFileName('   ')).toBe('document')
  })
})

describe('migration not run yet', () => {
  it('missing column/table codes are recognised', () => {
    for (const code of ['42703', '42P01', 'PGRST204', 'PGRST205'])
      expect(isMissingSchema({ code })).toBe(true)
    expect(isMissingSchema({ code: '23505' })).toBe(false)
    expect(isMissingSchema(null)).toBe(false)
  })
})

describe('the Customer Profile Core is the only way into its schema', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : files(path)
      return path.endsWith('.ts') ? [path] : []
    })

  it('no file outside services/customer-profile touches customer_documents, the bucket or the phase-3 columns', () => {
    const offenders = files(SRC)
      .filter(
        (file) => !relative(SRC, file).replace(/\\/g, '/').startsWith('services/customer-profile/'),
      )
      .filter((file) =>
        /customer_documents|customer-documents|payment_terms_days|supplier_id: input/.test(
          readFileSync(file, 'utf8'),
        ),
      )
      .map((file) => relative(SRC, file))
    expect(offenders).toEqual([])
  })

  it('routes use the index, check capabilities and validate ids', () => {
    const routes = readFileSync(join(SRC, 'routes/customer-profile.routes.ts'), 'utf8')
    expect(routes).toContain("from '../services/customer-profile'")
    expect(routes).not.toMatch(/services\/customer-profile\/customer-profile\./)
    expect(routes).toContain("requireCapability('customer.read')")
    expect(routes).toContain("requireCapability('customer.write')")
    expect(routes).toContain('z.string().uuid()')
    expect(readFileSync(join(SRC, 'index.ts'), 'utf8')).toContain(
      'server.register(customerProfileRoutes)',
    )
  })

  it('every query in the repository is scoped by workspace', () => {
    const repo = readFileSync(
      join(SRC, 'services/customer-profile/customer-profile.repository.ts'),
      'utf8',
    )
    const tableReads = repo.match(/\.from\('(customers|suppliers|customer_documents)'\)/g) ?? []
    const scoped = repo.match(/\.eq\('workspace_id', workspaceId\)/g) ?? []
    expect(tableReads.length).toBeGreaterThan(0)
    // insert carries workspace_id in the row instead of a filter
    expect(scoped.length).toBe(tableReads.length - 1)
  })
})

describe('phase 4 — accounting view', () => {
  const doc = (id: string, sourceType: 'invoice' | 'payment' = 'invoice') => ({
    sourceType,
    sourceId: id,
    date: '2026-09-01',
    kind: 'sale',
    reference: id,
    amount: 100,
  })
  const entry = (
    id: string,
    sourceId: string,
    over: Partial<{ status: string; reversalOf: string | null; sourceType: string }> = {},
  ) => ({
    id,
    entryNumber: id,
    date: '2026-09-01',
    status: 'posted',
    sourceType: 'invoice',
    sourceId,
    reversalOf: null,
    lines: [{ accountCode: '1200', accountName: 'AR', debit: 100, credit: 0 }],
    ...over,
  })

  it('a posted entry puts the document in the ledger', () => {
    const [row] = matchDocumentEntries([doc('a')], [entry('e1', 'a')])
    expect(row).toMatchObject({ unposted: false })
    expect(row!.entries[0]!.lines[0]).toEqual({
      accountCode: '1200',
      accountName: 'AR',
      debit: 100,
      credit: 0,
    })
  })

  it('no entry, a draft, or a reversed posting → unposted', () => {
    const rows = matchDocumentEntries(
      [doc('none'), doc('draft'), doc('rev')],
      [
        entry('d', 'draft', { status: 'draft' }),
        entry('p', 'rev'),
        entry('r', 'rev', { reversalOf: 'p' }),
      ],
    )
    expect(rows.map((row) => row.unposted)).toEqual([true, true, true])
  })

  it('source type matters: a payment entry does not post an invoice with the same id', () => {
    expect(
      matchDocumentEntries([doc('x', 'invoice')], [entry('e', 'x', { sourceType: 'payment' })])[0]!
        .unposted,
    ).toBe(true)
  })
})

describe('phase 4 — insights are rules over server figures', () => {
  const month = (sales: number, receipts: number, i: number) => ({
    month: `2026-${String(i + 1).padStart(2, '0')}`,
    sales,
    receipts,
  })
  const base = {
    asOf: '2026-09-17',
    receivable: 0,
    overdue: 0,
    overdueInvoiceCount: 0,
    lastSaleAt: '2026-09-10',
    monthly: [] as Array<{ month: string; sales: number; receipts: number }>,
    credit: null,
    unpostedCount: 0,
  }
  const codes = (input: Partial<typeof base> & Record<string, unknown>) =>
    customerInsights({ ...base, ...input } as Parameters<typeof customerInsights>[0]).map(
      (i) => i.code,
    )

  it('no activity at all', () => {
    expect(codes({})).toEqual(['NO_ACTIVITY'])
  })

  it('sales trend compares last 3 months with the 3 before (±20%)', () => {
    const up = [100, 100, 100, 150, 150, 150].map((s, i) => month(s, s, i))
    const down = [100, 100, 100, 70, 70, 70].map((s, i) => month(s, s, i))
    const flat = [100, 100, 100, 110, 110, 110].map((s, i) => month(s, s, i))
    expect(codes({ monthly: up })).toContain('SALES_UP')
    expect(codes({ monthly: down })).toContain('SALES_DOWN')
    expect(codes({ monthly: flat })).not.toEqual(expect.arrayContaining(['SALES_UP']))
  })

  it('credit, overdue, collection, inactivity and unposted — most severe first', () => {
    const result = customerInsights({
      ...base,
      receivable: 1000,
      overdue: 600,
      overdueInvoiceCount: 2,
      lastSaleAt: '2026-05-01',
      monthly: [month(1000, 100, 0)],
      credit: { creditLimit: 800, used: 1000, available: -200, usedPercent: 125, overLimit: true },
      unpostedCount: 3,
    })
    expect(result[0]).toEqual({
      code: 'OVER_CREDIT_LIMIT',
      severity: 'critical',
      values: { limit: 800, used: 1000, over: 200 },
    })
    expect(result.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        'OVERDUE_SHARE_HIGH',
        'LOW_COLLECTION',
        'INACTIVE',
        'UNPOSTED_DOCUMENTS',
      ]),
    )
    expect(result.find((i) => i.code === 'INACTIVE')!.values.days).toBe(139)
  })
})
