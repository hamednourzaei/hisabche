// ============================================
// backend/src/routes/invoice-pdf.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { createHash } from 'crypto'
import { renderToStream } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { supabase } from '../db'
import InvoicePDFDocument from '../pdf/InvoicePDFDocument'

// Load env
dotenv.config({ path: '../../.env' })

// ─── Supabase Storage Client ───────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || ''

// Only create storage client if credentials exist
const storageClient = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

const BUCKET_NAME = 'pdf-cache'

// Ensure bucket exists (only if client available)
if (storageClient) {
  storageClient.storage.getBucket(BUCKET_NAME).catch(() => {
    storageClient.storage.createBucket(BUCKET_NAME, { public: true })
  })
}

// ─── Helpers ──────────────────────────────────────────
function getCachePath(invoiceId: string): string {
  const hash = createHash('md5').update(invoiceId).digest('hex')
  return `invoices/${hash}.pdf`
}

async function getCachedUrl(invoiceId: string): Promise<string | null> {
  if (!storageClient) return null
  const path = getCachePath(invoiceId)
  const { data } = await storageClient.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

async function uploadPdf(invoiceId: string, buffer: Buffer): Promise<string | null> {
  if (!storageClient) return null
  const path = getCachePath(invoiceId)
  await storageClient.storage
    .from(BUCKET_NAME)
    .upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '86400',
    })
  const { data } = storageClient.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path)
  return data.publicUrl
}

// ─── Routes ───────────────────────────────────────────
export async function invoicePdfRoutes(fastify: FastifyInstance) {

  fastify.get('/api/invoices/:id/pdf', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }

    // 1. Check cache (if storage available)
    const cachedUrl = await getCachedUrl(id)
    if (cachedUrl) {
      return reply.redirect(302, cachedUrl)
    }

    // 2. Fetch invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', id)
      .single()

    if (error || !invoice) {
      return reply.code(404).send({ error: 'Invoice not found' })
    }

    try {
      // 3. Generate PDF
      const stream = await renderToStream(
        InvoicePDFDocument({ invoice: invoice as any })
      )

      // 4. Cache in background (non-blocking)
      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', async () => {
        if (storageClient) {
          const buffer = Buffer.concat(chunks)
          try { await uploadPdf(id, buffer) } catch {}
        }
      })

      reply.header('Content-Type', 'application/pdf')
      reply.header('Content-Disposition', `attachment; filename="Invoice-${(invoice as any).invoice_number || id}.pdf"`)
      reply.header('Cache-Control', 'public, max-age=3600')

      return reply.send(stream)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'PDF generation failed' })
    }
  })
}