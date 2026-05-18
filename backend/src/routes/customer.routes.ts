import { FastifyInstance, FastifyRequest } from 'fastify'
import { supabase } from '../db'

export async function customerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/customers', async (request: FastifyRequest) => {
    const query = request.query as any
    const search = query.search || ''
    const page = parseInt(query.page || '1')
    const limit = parseInt(query.limit || '20')

    let q = supabase.from('customers').select('*', { count: 'exact' })
    if (search) q = q.ilike('full_name', `%${search}%`)
    q = q.range((page - 1) * limit, page * limit - 1)

    const { data, count } = await q
    return { customers: data || [], total: count || 0 }
  })

  fastify.post('/api/customers', async (request: FastifyRequest) => {
    const body = request.body as any
    const { data, error } = await supabase.from('customers').insert({
      full_name: body.fullName || body.full_name || '',
      phone: body.phone || '',
      email: body.email || '',
      opening_balance: body.openingBalance || body.opening_balance || 0,
      is_active: body.isActive !== false,
    }).select().single()
    if (error) return { error: error.message }
    return data
  })

  fastify.patch('/api/customers/:id', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string }
    const body = request.body as any
    const { data } = await supabase.from('customers').update({
      full_name: body.fullName || body.full_name,
      phone: body.phone,
      email: body.email,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single()
    return data || { error: 'Not found' }
  })

  fastify.delete('/api/customers/:id', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string }
    await supabase.from('customers').delete().eq('id', id)
    return { success: true }
  })
}