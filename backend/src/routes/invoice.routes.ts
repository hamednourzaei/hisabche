import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from '../db'

// ============================================
// Types
// ============================================
interface InvoiceItemInput {
  product_id?: string
  productId?: string
  product_name?: string
  productName?: string
  quantity?: number
  unit_price?: number
  unitPrice?: number
  discount?: number
  total_price?: number
  totalPrice?: number
}

interface InvoiceItemRow {
  invoice_id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  discount: number
  total_price: number
  user_id: string
}

interface CreateInvoiceBody {
  invoiceNumber?: string
  type?: 'sale' | 'purchase'
  customerId?: string
  supplierId?: string
  date?: string
  dueDate?: string
  subtotal?: number
  discountTotal?: number
  taxTotal?: number
  total: number
  paidAmount?: number
  currency?: string
  paymentMethod?: string
  status?: string
  notes?: string
  customerName?: string
  items?: InvoiceItemInput[]
}

// ============================================
// UUID validator
// ============================================
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(s: string): boolean {
  return UUID_RE.test(s)
}

// ============================================
// Normalize item
// ============================================
function normalizeItem(
  item: InvoiceItemInput,
  invoiceId: string,
  fallbackProductId: string | null,
  userId: string
): InvoiceItemRow {
  const rawId = item.product_id ?? item.productId ?? ''

  return {
    invoice_id:   invoiceId,
    product_id:   isUUID(rawId) ? rawId : fallbackProductId,
    product_name: item.product_name ?? item.productName ?? '',
    quantity:     item.quantity ?? 1,
    unit_price:   item.unit_price ?? item.unitPrice ?? 0,
    discount:     item.discount ?? 0,
    total_price:  item.total_price ?? item.totalPrice ?? 0,
    user_id:      userId,
  }
}

// ============================================
// Routes
// ============================================
export async function invoiceRoutes(fastify: FastifyInstance) {

  // GET /api/invoices
  fastify.get('/api/invoices', async (request: FastifyRequest, reply: FastifyReply) => {
    const q      = request.query as Record<string, string>
    const search = q.search ?? ''
    const page   = Math.max(1, parseInt(q.page  ?? '1'))
    const limit  = Math.min(100, parseInt(q.limit ?? '20'))
    const type   = q.type   ?? ''
    const status = q.status ?? ''
    const from   = (page - 1) * limit
    const to     = from + limit - 1

    let query = supabase
      .from('invoices')
      .select('*, invoice_items(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) query = query.ilike('invoice_number', `%${search}%`)
    if (type)   query = query.eq('type', type)
    if (status) query = query.eq('status', status)

    const { data, error, count } = await query
    if (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }

    return { invoices: data ?? [], total: count ?? 0, page, limit }
  })

  // GET /api/invoices/:id
  fastify.get('/api/invoices/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }

    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', id)
      .single()

    if (error) return reply.code(404).send({ error: 'Invoice not found' })
    return data
  })

  // POST /api/invoices
  fastify.post('/api/invoices', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as CreateInvoiceBody
    const userId = (request as any).userId

    // 1. Insert invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: body.invoiceNumber ?? `INV-${Date.now().toString(36).toUpperCase()}`,
        type:           body.type          ?? 'sale',
        customer_id:    body.customerId    ?? null,
        supplier_id:    body.supplierId    ?? null,
        date:           body.date          ?? new Date().toISOString(),
        due_date:       body.dueDate       ?? null,
        subtotal:       body.subtotal      ?? 0,
        discount_total: body.discountTotal ?? 0,
        tax_total:      body.taxTotal      ?? 0,
        total:          body.total         ?? 0,
        paid_amount:    body.paidAmount    ?? 0,
        currency:       body.currency      ?? 'AFN',
        payment_method: body.paymentMethod ?? 'cash',
        status:         body.status        ?? 'pending',
        notes:          body.notes         ?? '',
        user_id:        userId,
      })
      .select()
      .single()

    if (invoiceError || !invoice) {
      fastify.log.error(invoiceError ?? 'Invoice insert returned null')
      return reply.code(500).send({ error: invoiceError?.message ?? 'Failed to create invoice' })
    }

    // 2. Fetch fallback product
    let fallbackProductId: string | null = null
    if (body.items?.length) {
      const needsFallback = body.items.some(item => {
        const rawId = item.product_id ?? item.productId ?? ''
        return rawId !== '' && !isUUID(rawId)
      })
      if (needsFallback) {
        const { data: firstProduct } = await supabase
          .from('products')
          .select('id')
          .limit(1)
          .single()
        fallbackProductId = firstProduct?.id ?? null
      }
    }

    // 3. Insert items
    if (body.items && body.items.length > 0) {
      const items: InvoiceItemRow[] = body.items.map(item =>
        normalizeItem(item, invoice.id, fallbackProductId, userId)
      )

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(items)

      if (itemsError) {
        fastify.log.error(itemsError)
        await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id)
        await supabase.from('invoices').delete().eq('id', invoice.id)
        return reply.code(500).send({ error: itemsError.message })
      }

      // 4. Decrement stock
      if (body.type === 'sale' || !body.type) {
        for (const item of items) {
          if (!item.product_id) continue
          try {
            await supabase.rpc('decrement_stock', {
              p_product_id: item.product_id,
              p_quantity:   item.quantity,
            })
          } catch {
            // RPC not available — skip
          }
        }
      }
    }

    // 5. Record transaction
    if (body.customerId && body.paidAmount !== undefined) {
      const remaining = (body.total ?? 0) - (body.paidAmount ?? 0)
      if (remaining > 0) {
        try {
          await supabase.from('transactions').insert({
            customer_id: body.customerId,
            type:        'sale',
            amount:      remaining,
            currency:    body.currency ?? 'AFN',
            description: `Invoice ${invoice.invoice_number}`,
            reference:   invoice.id,
            date:        new Date().toISOString(),
            user_id:     userId,
          })
        } catch (e) {
          fastify.log.error(e, 'Transaction insert failed — non-fatal')
        }
      }
    }

    return reply.code(201).send(invoice)
  })

  // PATCH /api/invoices/:id
  fastify.patch('/api/invoices/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body   = request.body as Partial<CreateInvoiceBody>

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.status      != null) updates.status      = body.status
    if (body.paidAmount  != null) updates.paid_amount = body.paidAmount
    if (body.total       != null) updates.total       = body.total
    if (body.notes       != null) updates.notes       = body.notes

    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  // DELETE /api/invoices/:id
  fastify.delete('/api/invoices/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }

    await supabase.from('invoice_items').delete().eq('invoice_id', id)

    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: error.message })
    }

    return reply.code(204).send()
  })

  // GET /api/invoices/:id/items
  fastify.get('/api/invoices/:id/items', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }

    const { data, error } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', id)
      .order('created_at', { ascending: true })

    if (error) return reply.code(500).send({ error: error.message })
    return data ?? []
  })
}