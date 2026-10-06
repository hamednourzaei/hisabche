// ============================================
// The AI action pipeline — its rules, with no I/O.
//
// What can go wrong, and is pinned here:
//   a model's reply naming an operation, a route or an id it was never given;
//   a guessed value proposed as if the person had said it;
//   a product with no price sold at ZERO;
//   a customer that was named and not found turning into a walk-in sale;
//   an answer choosing a record the person was never shown;
//   a financial operation approved by a rule instead of a person;
//   a payment's read-back compared loosely enough that a wrong amount passes.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  AUTO_ALLOCATION,
  DEFAULT_PIPELINE_SETTINGS,
  OPERATION_SPECS,
  PIPELINE_OPERATIONS,
  applyAnswers,
  asciiDigits,
  idempotencyKeyOf,
  mayAutoApprove,
  parseDraft,
  parseIntent,
  pickOne,
  plan,
  readBackCall,
  sameName,
  toHttpCall,
  toNumber,
  verifyOutcome,
  type PartyFact,
  type PipelineFacts,
  type PipelinePlan,
  type ProductFact,
} from '../services/ai/pipeline/pipeline.domain'

const AHMAD: PartyFact = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'احمد کریمی',
  phone: '0700123456',
  email: null,
  address: 'کابل',
  notes: null,
  type: 'cash',
  isActive: true,
  updatedAt: '2026-10-01T08:00:00.000000+00:00',
}
const AHMAD_2: PartyFact = {
  ...AHMAD,
  id: '22222222-2222-4222-8222-222222222222',
  fullName: 'احمد نوری',
}
const TEA: ProductFact = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'چای سبز',
  unit: 'kg',
  sellPrice: 450,
  quantity: 10,
}
const UNPRICED: ProductFact = {
  ...TEA,
  id: '44444444-4444-4444-8444-444444444444',
  name: 'قند',
  sellPrice: 0,
}

const facts = (over: Partial<PipelineFacts> = {}): PipelineFacts => ({
  customer: { state: 'absent' },
  products: [],
  openInvoices: [],
  duplicates: [],
  ...over,
})
const one = <T>(value: T, exact = true) => ({ state: 'one' as const, value, exact })
const ready = (planned: PipelinePlan) => {
  if (planned.kind !== 'ready') throw new Error(`expected a proposal, got ${planned.kind}`)
  return planned
}
const questionsOf = (planned: PipelinePlan) => {
  if (planned.kind !== 'questions') throw new Error(`expected questions, got ${planned.kind}`)
  return planned.questions
}

describe('numbers a person typed', () => {
  it('reads Persian and Arabic digits with their own separators', () => {
    expect(toNumber('۱٬۲۵۰٫۵')).toBe(1250.5)
    expect(toNumber('١٢٥٠')).toBe(1250)
    expect(toNumber('1,250.50')).toBe(1250.5)
    expect(toNumber(450)).toBe(450)
    expect(asciiDigits('۰۷۰۰')).toBe('0700')
  })

  it('answers null — never zero — for anything that is not plainly one number', () => {
    for (const value of ['', 'ده', '12 تا', '1.2.3', null, undefined, Number.NaN, {}]) {
      expect(toNumber(value), String(value)).toBeNull()
    }
  })
})

describe('understanding: the model fills a closed form', () => {
  it('takes an operation from the closed list and the fields that were stated', () => {
    const intent = parseIntent(
      'Sure: {"operation":"register_payment","fields":{"customerName":"احمد","amount":"۵۰۰"},"uncertain":[]}',
    )
    expect(intent.operation).toBe('register_payment')
    expect(intent.draft).toEqual({ customerName: 'احمد', amount: 500 })
  })

  it.each([
    ['not JSON at all', 'I will delete everything now.'],
    ['an operation outside the list', '{"operation":"delete_invoice","fields":{}}'],
    ['none', '{"operation":"none","fields":{},"uncertain":[]}'],
    ['an array', '[{"operation":"create_invoice"}]'],
    ['broken JSON', '{"operation":"create_invoice","fields":{'],
  ])('%s is «nothing to do»', (_label, reply) => {
    expect(parseIntent(reply)).toEqual({ operation: null, draft: {}, uncertain: [] })
  })

  it('a value the model says it guessed is asked for, not proposed', () => {
    const intent = parseIntent(
      '{"operation":"register_payment","fields":{"customerName":"احمد","amount":500},"uncertain":["amount"]}',
    )
    expect(intent.draft).toEqual({ customerName: 'احمد' })
    expect(intent.uncertain).toEqual(['amount'])
  })

  it('an id, a workspace or a route written by the model never reaches the draft', () => {
    const intent = parseIntent(
      JSON.stringify({
        operation: 'create_invoice',
        fields: {
          customerId: AHMAD.id,
          invoiceId: AHMAD.id,
          allocation: 'auto',
          workspaceId: AHMAD.id,
          url: '/api/admin',
          items: [{ productId: TEA.id, productName: 'چای', quantity: 2 }],
        },
      }),
    )
    expect(intent.draft).toEqual({ items: [{ productName: 'چای', quantity: 2 }] })
  })

  it('one malformed field does not cost the fields that were understood', () => {
    expect(parseDraft({ fullName: 'احمد', phone: 'call me', email: 'x', amount: -5 })).toEqual({
      fullName: 'احمد',
    })
    // …and a phone in Persian digits is the phone, not a malformed field.
    expect(parseDraft({ phone: '۰۷۰۰۱۲۳۴۵۶' })).toEqual({ phone: '0700123456' })
  })
})

describe('finding the record that was named', () => {
  it('an exact name wins over «several matched»', () => {
    const found = pickOne([AHMAD_2, AHMAD], 'احمد كريمي', (party) => party.fullName)
    expect(found).toEqual({ state: 'one', value: AHMAD, exact: true })
    expect(sameName('احمد  كريمي', 'احمد کریمی')).toBe(true)
  })

  it('a single fuzzy result is accepted but marked inexact; several are a question', () => {
    expect(pickOne([AHMAD], 'احمد', (party) => party.fullName)).toMatchObject({
      state: 'one',
      exact: false,
    })
    expect(pickOne([AHMAD, AHMAD_2], 'احمد', (party) => party.fullName).state).toBe('many')
    expect(pickOne([], 'احمد', (party: PartyFact) => party.fullName)).toEqual({
      state: 'none',
      asked: 'احمد',
    })
  })

  it('never offers more than six choices', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      ...AHMAD,
      id: String(index),
      fullName: `احمد ${index}`,
    }))
    const found = pickOne(many, 'احمد', (party) => party.fullName)
    expect(found.state === 'many' && found.options.length).toBe(6)
  })
})

describe('create_invoice', () => {
  it('with no goods named, asks which goods', () => {
    expect(questionsOf(plan('create_invoice', {}, facts()))).toEqual([
      { id: 'items', field: 'items', kind: 'text', reason: 'missing' },
    ])
  })

  it('a product with no sell price is ASKED for a price, never sold at zero', () => {
    const asked = questionsOf(
      plan(
        'create_invoice',
        { items: [{ productName: 'قند', quantity: 3 }] },
        facts({ products: [one(UNPRICED)] }),
      ),
    )
    expect(asked).toEqual([
      {
        id: 'item:0:unitPrice',
        field: 'unitPrice',
        kind: 'number',
        reason: 'missing',
        subject: 'قند',
      },
    ])
  })

  it('a customer that was named and not found is a question — not a walk-in sale', () => {
    const asked = questionsOf(
      plan(
        'create_invoice',
        { customerName: 'محمود', items: [{ productName: 'چای', quantity: 1 }] },
        facts({ customer: { state: 'none', asked: 'محمود' }, products: [one(TEA)] }),
      ),
    )
    expect(asked.map((question) => `${question.id}:${question.reason}`)).toEqual([
      'customer:not_found',
    ])
  })

  it('no customer named at all is a walk-in sale, said in the proposal', () => {
    const { command, proposal } = ready(
      plan(
        'create_invoice',
        { items: [{ productName: 'چای', quantity: 2 }] },
        facts({ products: [one(TEA)] }),
      ),
    )
    expect(command.body.customerId).toBeUndefined()
    expect(proposal.changes[0]).toEqual({
      entity: 'invoice',
      field: 'customer',
      from: null,
      to: null,
    })
  })

  it('an ambiguous product and a missing quantity are both asked, by line', () => {
    const asked = questionsOf(
      plan(
        'create_invoice',
        { items: [{ productName: 'چای' }, { productName: 'چای سبز' }] },
        facts({ products: [{ state: 'many', asked: 'چای', options: [TEA, UNPRICED] }, one(TEA)] }),
      ),
    )
    expect(asked.map((question) => question.id)).toEqual(['item:0:product', 'item:1:quantity'])
    expect(asked[0]?.options?.map((option) => option.value)).toEqual([TEA.id, UNPRICED.id])
  })

  it('proposes the lines at the product price, unpaid, and says what it assumed', () => {
    const { command, proposal } = ready(
      plan(
        'create_invoice',
        { customerName: 'احمد', items: [{ productName: 'چای سبز', quantity: 12 }] },
        facts({ customer: one(AHMAD, false), products: [one(TEA)] }),
      ),
    )
    // 12 × 450 = 5400 — worked by hand.
    expect(command.expect).toEqual({ total: 5400, itemCount: 1, customerId: AHMAD.id })
    expect(command.body).toMatchObject({
      type: 'sale',
      customerId: AHMAD.id,
      currency: 'AFN',
      paidAmount: 0,
    })
    expect(command.body.items).toEqual([
      {
        productId: TEA.id,
        productName: 'چای سبز',
        quantity: 12,
        unit: 'kg',
        unitPrice: 450,
        totalPrice: 5400,
      },
    ])
    expect(proposal.warnings.map((warning) => warning.code)).toEqual([
      'INSUFFICIENT_STOCK', // 12 asked, 10 on hand: recorded, and said first
      'DEFAULT_CURRENCY', // nobody named a currency
      'INEXACT_MATCH', // «احمد» is not the customer's whole name
    ])
    expect(proposal.exactMatches).toBe(false)
  })

  it('a stated price and currency are used as stated', () => {
    const { command, proposal } = ready(
      plan(
        'create_invoice',
        { currency: 'USD', items: [{ productName: 'چای سبز', quantity: 1.5, unitPrice: 9.99 }] },
        facts({ products: [one(TEA)] }),
      ),
    )
    // 1.5 × 9.99 = 14.985 → 14.99
    expect(command.expect.total).toBe(14.99)
    expect(command.body.currency).toBe('USD')
    expect(proposal.warnings).toEqual([])
  })
})

describe('register_payment', () => {
  const open = [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', invoiceNumber: 'INV-0007', outstanding: 300 },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', invoiceNumber: 'INV-0009', outstanding: 200 },
  ]

  it('asks who and how much when neither was said', () => {
    expect(
      questionsOf(plan('register_payment', {}, facts())).map((question) => question.id),
    ).toEqual(['customer', 'amount'])
  })

  it('with no invoice named, leaves the allocation to the payments core', () => {
    const { command, proposal } = ready(
      plan(
        'register_payment',
        { amount: 400 },
        facts({ customer: one(AHMAD), openInvoices: open }),
      ),
    )
    expect(command.body).toEqual({
      direction: 'in',
      partyType: 'customer',
      partyId: AHMAD.id,
      amount: 400,
      currency: 'AFN',
      method: 'cash',
    })
    expect(proposal.changes.find((change) => change.field === 'appliedTo')?.to).toBe(
      AUTO_ALLOCATION,
    )
  })

  it('a named invoice is settled by name, and never by more than it owes', () => {
    const { command, proposal } = ready(
      plan(
        'register_payment',
        { amount: 350, invoiceNumber: 'inv-0007', currency: 'AFN' },
        facts({ customer: one(AHMAD), openInvoices: open }),
      ),
    )
    expect(command.body.allocations).toEqual([{ invoiceId: open[0]?.id, amount: 300 }])
    expect(proposal.warnings.map((warning) => warning.code)).toEqual(['AMOUNT_EXCEEDS_INVOICE'])
  })

  it('an invoice that was named and is not owed is a question, not «the oldest instead»', () => {
    const asked = questionsOf(
      plan(
        'register_payment',
        { amount: 100, invoiceNumber: 'INV-9999' },
        facts({ customer: one(AHMAD), openInvoices: open }),
      ),
    )
    expect(asked).toHaveLength(1)
    expect(asked[0]?.options?.map((option) => option.value)).toEqual([
      AUTO_ALLOCATION,
      open[0]?.id,
      open[1]?.id,
    ])
  })

  it('says so when the money is more than the customer owes, or nothing is owed', () => {
    const over = ready(
      plan(
        'register_payment',
        { amount: 900, currency: 'AFN' },
        facts({ customer: one(AHMAD), openInvoices: open }),
      ),
    )
    expect(over.proposal.warnings).toEqual([
      { code: 'AMOUNT_EXCEEDS_DEBT', detail: { owed: 500, amount: 900 } },
    ])
    const none = ready(
      plan('register_payment', { amount: 50, currency: 'AFN' }, facts({ customer: one(AHMAD) })),
    )
    expect(none.proposal.warnings.map((warning) => warning.code)).toEqual(['NO_OPEN_INVOICES'])
  })
})

describe('create_customer and update_customer', () => {
  it('a new customer needs a name, and a namesake is pointed out', () => {
    expect(questionsOf(plan('create_customer', { phone: '0700123456' }, facts()))[0]?.id).toBe(
      'fullName',
    )
    const { command, proposal } = ready(
      plan(
        'create_customer',
        { fullName: 'احمد کریمی', phone: '0700123456' },
        facts({ duplicates: [AHMAD] }),
      ),
    )
    expect(command.body).toEqual({ fullName: 'احمد کریمی', type: 'cash', phone: '0700123456' })
    expect(proposal.warnings.map((warning) => warning.code)).toEqual(['POSSIBLE_DUPLICATE'])
  })

  it('a change is proposed only for what would really change', () => {
    const { command, proposal } = ready(
      plan(
        'update_customer',
        { customerName: 'احمد کریمی', phone: '0799000111', address: 'کابل' },
        facts({ customer: one(AHMAD) }),
      ),
    )
    expect(proposal.changes).toEqual([
      { entity: 'customer', field: 'phone', from: '0700123456', to: '0799000111' },
    ])
    // The write is conditional on the row still being the one that was read.
    expect(command).toMatchObject({
      targetId: AHMAD.id,
      body: { phone: '0799000111', expectedUpdatedAt: AHMAD.updatedAt },
      expect: { phone: '0799000111' },
    })
  })

  it('nothing would change → refused, not an empty write', () => {
    expect(
      plan(
        'update_customer',
        { customerName: 'احمد', address: 'کابل' },
        facts({ customer: one(AHMAD) }),
      ),
    ).toEqual({ kind: 'refused', reason: 'NOTHING_TO_CHANGE' })
  })

  it('no change stated → asks what to change; nobody named → asks who', () => {
    expect(
      questionsOf(
        plan('update_customer', { customerName: 'احمد' }, facts({ customer: one(AHMAD) })),
      )[0]?.id,
    ).toBe('changes')
    expect(questionsOf(plan('update_customer', { phone: '0799000111' }, facts()))[0]).toMatchObject(
      {
        id: 'customer',
        reason: 'missing',
      },
    )
  })
})

describe('answers', () => {
  const customerChoice = {
    id: 'customer',
    field: 'customer' as const,
    kind: 'choice' as const,
    reason: 'ambiguous' as const,
    options: [
      { value: AHMAD.id, label: AHMAD.fullName },
      { value: AHMAD_2.id, label: AHMAD_2.fullName },
    ],
  }

  it('a choice must be one of the options that were offered', () => {
    const stranger = '99999999-9999-4999-8999-999999999999'
    expect(
      applyAnswers({ customerName: 'احمد' }, [customerChoice], { customer: stranger }).draft,
    ).toEqual({
      customerName: 'احمد',
    })
    expect(
      applyAnswers({ customerName: 'احمد' }, [customerChoice], { customer: AHMAD_2.id }).draft,
    ).toEqual({
      customerName: 'احمد',
      customerId: AHMAD_2.id,
    })
  })

  it('an answer to a question that was not asked changes nothing', () => {
    expect(
      applyAnswers({ customerName: 'احمد' }, [customerChoice], { amount: 1_000_000 }).draft,
    ).toEqual({
      customerName: 'احمد',
    })
  })

  it('numbers are read as a person writes them, per line', () => {
    const { draft } = applyAnswers(
      { items: [{ productName: 'چای', productId: TEA.id }] },
      [
        { id: 'item:0:quantity', field: 'quantity', kind: 'number', reason: 'missing' },
        { id: 'item:0:unitPrice', field: 'unitPrice', kind: 'number', reason: 'missing' },
      ],
      { 'item:0:quantity': '۲٫۵', 'item:0:unitPrice': 'گران' },
    )
    expect(draft.items).toEqual([{ productName: 'چای', productId: TEA.id, quantity: 2.5 }])
  })

  it('a newly typed name replaces a chosen record; free text goes back to the model', () => {
    const typed = applyAnswers(
      { customerName: 'احمد', customerId: AHMAD.id },
      [{ id: 'customer', field: 'customer', kind: 'text', reason: 'not_found' }],
      { customer: 'محمود' },
    )
    expect(typed.draft).toEqual({ customerName: 'محمود' })
    const free = applyAnswers(
      {},
      [{ id: 'items', field: 'items', kind: 'text', reason: 'missing' }],
      {
        items: 'دو کیلو چای',
      },
    )
    expect(free).toEqual({ draft: {}, retext: ['دو کیلو چای'] })
  })

  it('«the oldest invoices» is chosen by the person', () => {
    const question = {
      id: 'invoice',
      field: 'invoice' as const,
      kind: 'choice' as const,
      reason: 'not_found' as const,
      options: [{ value: AUTO_ALLOCATION, label: AUTO_ALLOCATION }],
    }
    expect(
      applyAnswers({ invoiceNumber: 'INV-9999', amount: 5 }, [question], {
        invoice: AUTO_ALLOCATION,
      }).draft,
    ).toEqual({
      amount: 5,
      allocation: 'auto',
    })
  })
})

describe('the route a command runs through', () => {
  const RUN = '55555555-5555-4555-8555-555555555555'

  it('comes from the operation — a closed list', () => {
    const routes = PIPELINE_OPERATIONS.map((operation) => {
      const call = toHttpCall({ operation, body: {}, targetId: AHMAD.id, expect: {} }, RUN)
      return `${call.method} ${call.url}`
    })
    expect(routes).toEqual([
      'POST /api/invoices',
      'POST /api/payments',
      'POST /api/customers',
      `PATCH /api/customers/${AHMAD.id}`,
    ])
  })

  it('every create carries the run as its idempotency key', () => {
    expect(idempotencyKeyOf(RUN)).toBe(`aip-${RUN}`)
    for (const operation of ['create_invoice', 'register_payment', 'create_customer'] as const) {
      expect(toHttpCall({ operation, body: {}, expect: {} }, RUN).idempotencyKey).toBe(`aip-${RUN}`)
    }
  })

  it('a target id cannot add a path', () => {
    const call = toHttpCall(
      { operation: 'update_customer', body: {}, targetId: '../admin', expect: {} },
      RUN,
    )
    expect(call.url).toBe('/api/customers/..%2Fadmin')
    expect(readBackCall('register_payment', 'a/b').url).toBe('/api/payments/a%2Fb')
  })

  it('money and stock always need a person; the rest may be automated', () => {
    expect(PIPELINE_OPERATIONS.filter((operation) => OPERATION_SPECS[operation].financial)).toEqual(
      ['create_invoice', 'register_payment'],
    )
  })
})

describe('verification', () => {
  const invoice = {
    operation: 'create_invoice' as const,
    body: {},
    expect: { total: 5400, itemCount: 1, customerId: AHMAD.id },
  }

  it('passes when the books say what was agreed', () => {
    expect(
      verifyOutcome(invoice, { total: '5400.00', items: [{}], customer: { id: AHMAD.id } }),
    ).toEqual([])
  })

  it('names every field that differs', () => {
    expect(
      verifyOutcome(invoice, { total: 54, items: [], customer: null }).map((miss) => miss.field),
    ).toEqual(['total', 'itemCount', 'customer'])
    // Scale, not only equality: a hundredth of the amount is not «close».
    expect(
      verifyOutcome(invoice, { total: 5400.01, items: [{}], customer: { id: AHMAD.id } }),
    ).toHaveLength(1)
  })

  it('a cancelled payment, or one for somebody else, is not the payment that was agreed', () => {
    const payment = {
      operation: 'register_payment' as const,
      body: {},
      expect: { amount: 400, partyId: AHMAD.id, direction: 'in' },
    }
    expect(
      verifyOutcome(payment, { amount: 400, partyId: AHMAD.id, direction: 'in', status: 'posted' }),
    ).toEqual([])
    expect(
      verifyOutcome(payment, {
        amount: 400,
        partyId: AHMAD_2.id,
        direction: 'in',
        status: 'cancelled',
      }).map((miss) => miss.field),
    ).toEqual(['partyId', 'status'])
  })

  it('a customer change is checked field by field', () => {
    const change = {
      operation: 'update_customer' as const,
      body: {},
      targetId: AHMAD.id,
      expect: { phone: '0799000111' },
    }
    expect(verifyOutcome(change, { ...AHMAD, phone: '0799000111' })).toEqual([])
    expect(verifyOutcome(change, AHMAD)).toEqual([
      { field: 'phone', expected: '0799000111', actual: '0700123456' },
    ])
  })
})

describe('approval by rule', () => {
  const on = { enabled: true, autoApproveNonFinancial: true }
  const clean = ready(plan('create_customer', { fullName: 'محمود' }, facts())).proposal

  it('is off unless somebody turned it on', () => {
    expect(DEFAULT_PIPELINE_SETTINGS).toEqual({ enabled: false, autoApproveNonFinancial: false })
    expect(mayAutoApprove(DEFAULT_PIPELINE_SETTINGS, clean, true)).toBe(false)
    expect(mayAutoApprove(on, clean, true)).toBe(true)
  })

  it('never approves money or stock, whatever the setting says', () => {
    const invoice = ready(
      plan(
        'create_invoice',
        { currency: 'AFN', items: [{ productName: 'چای سبز', quantity: 1 }] },
        facts({ products: [one(TEA)] }),
      ),
    ).proposal
    expect(invoice.warnings).toEqual([])
    expect(mayAutoApprove(on, invoice, true)).toBe(false)
  })

  it('is only for the unambiguous case, and only for somebody who could do it by hand', () => {
    expect(mayAutoApprove(on, clean, false)).toBe(false)
    const namesake = ready(
      plan('create_customer', { fullName: AHMAD.fullName }, facts({ duplicates: [AHMAD] })),
    ).proposal
    expect(mayAutoApprove(on, namesake, true)).toBe(false)
    const fuzzy = ready(
      plan(
        'update_customer',
        { customerName: 'احمد', phone: '0799000111' },
        facts({ customer: one(AHMAD, false) }),
      ),
    ).proposal
    expect(mayAutoApprove(on, fuzzy, true)).toBe(false)
  })
})
