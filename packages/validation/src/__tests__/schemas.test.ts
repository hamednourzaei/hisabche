// packages/validation/src/__tests__/schemas.test.ts
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Import your schemas — adjust path to your actual exports
// import { loginSchema, invoiceSchema, productSchema, customerSchema } from '../index'

// If schemas not exported from index, define them here for now
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const invoiceSchema = z.object({
  type: z.enum(['sale', 'purchase']).default('sale'),
  customer_id: z.string().uuid().optional(),
  date: z.string().datetime(),
  subtotal: z.number().min(0).default(0),
  total: z.number().min(0),
  paid_amount: z.number().min(0).default(0),
  currency: z.enum(['AFN', 'USD', 'PKR', 'IRR']).default('AFN'),
  payment_method: z.enum(['cash', 'credit']).default('cash'),
  items: z.array(z.object({
    product_id: z.string().uuid().optional(),
    product_name: z.string().optional(),
    quantity: z.number().positive(),
    unit_price: z.number().min(0),
    total_price: z.number().min(0),
  })).min(1),
})

const productSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(0).default(0),
  buy_price: z.number().min(0).default(0),
  sell_price: z.number().min(0).default(0),
  unit: z.enum(['piece', 'kg', 'liter', 'meter', 'box']).default('piece'),
  category: z.string().default('general'),
  min_stock_level: z.number().int().min(0).default(5),
})

const customerSchema = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  opening_balance: z.number().default(0),
})

// ============================================
// LOGIN SCHEMA
// ============================================
describe('loginSchema', () => {
  it('accepts valid login', () => {
    const result = loginSchema.safeParse({
      email: 'test@hisabche.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short password', () => {
    const result = loginSchema.safeParse({
      email: 'test@hisabche.com',
      password: '12345',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty email', () => {
    const result = loginSchema.safeParse({
      email: '',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })
})

// ============================================
// INVOICE SCHEMA
// ============================================
describe('invoiceSchema', () => {
  const validInvoice = {
    type: 'sale' as const,
    date: new Date().toISOString(),
    total: 5000,
    items: [{ product_name: 'Test', quantity: 2, unit_price: 2500, total_price: 5000 }],
  }

  it('accepts valid invoice', () => {
    const result = invoiceSchema.safeParse(validInvoice)
    expect(result.success).toBe(true)
  })

  it('applies defaults', () => {
    const result = invoiceSchema.safeParse(validInvoice)
    if (result.success) {
      expect(result.data.currency).toBe('AFN')
      expect(result.data.payment_method).toBe('cash')
      expect(result.data.subtotal).toBe(0)
    }
  })

  it('rejects negative total', () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, total: -100 })
    expect(result.success).toBe(false)
  })

  it('rejects empty items array', () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, items: [] })
    expect(result.success).toBe(false)
  })

  it('rejects invalid currency', () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, currency: 'EUR' })
    expect(result.success).toBe(false)
  })

  it('rejects zero quantity', () => {
    const result = invoiceSchema.safeParse({
      ...validInvoice,
      items: [{ product_name: 'Test', quantity: 0, unit_price: 100, total_price: 0 }],
    })
    expect(result.success).toBe(false)
  })
})

// ============================================
// PRODUCT SCHEMA
// ============================================
describe('productSchema', () => {
  it('accepts valid product', () => {
    const result = productSchema.safeParse({
      name: 'محصول تست',
      sell_price: 1000,
      buy_price: 500,
    })
    expect(result.success).toBe(true)
  })

  it('applies defaults', () => {
    const result = productSchema.safeParse({ name: 'Test' })
    if (result.success) {
      expect(result.data.quantity).toBe(0)
      expect(result.data.unit).toBe('piece')
      expect(result.data.category).toBe('general')
    }
  })

  it('rejects empty name', () => {
    const result = productSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects negative price', () => {
    const result = productSchema.safeParse({ name: 'Test', sell_price: -100 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid unit', () => {
    const result = productSchema.safeParse({ name: 'Test', unit: 'dozen' })
    expect(result.success).toBe(false)
  })
})

// ============================================
// CUSTOMER SCHEMA
// ============================================
describe('customerSchema', () => {
  it('accepts valid customer', () => {
    const result = customerSchema.safeParse({
      full_name: 'احمد',
      phone: '0744123456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = customerSchema.safeParse({ full_name: '' })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = customerSchema.safeParse({ full_name: 'Test' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = customerSchema.safeParse({ full_name: 'Test', email: 'bad' })
    expect(result.success).toBe(false)
  })
})