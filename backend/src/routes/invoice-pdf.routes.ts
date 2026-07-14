// ============================================
// backend/src/routes/invoice-pdf.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { createHash } from 'crypto'
import { renderToStream } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../db'
import InvoicePDFDocument from '../pdf/InvoicePDFDocument'

// NOTE: dotenv.config() should run once at the app entrypoint (server.ts),
// not inside individual route files — loading it here again is fragile
// (relative path depends on where the process was started from) and can
// silently no-op if env vars are already loaded elsewhere.

// ─── Supabase Storage Client (service role — storage admin only) ───────────
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || ''

const storageClient = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

const BUCKET_NAME = 'pdf-cache'
const SIGNED_URL_TTL_SECONDS = 3600

// The bucket MUST be private. Invoices are financial documents — a public
// bucket means anyone with the URL (no login required) can read them,
// which also makes the createSignedUrl() call below pointless.
if (storageClient) {
  storageClient.storage.getBucket(BUCKET_NAME).catch(() => {
    storageClient.storage.createBucket(BUCKET_NAME, { public: false })
  })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Helpers ─────────────────────────────────────────────────────────────
// Cache path includes a content-version (updated_at) so an edited invoice
// gets a new path automatically instead of serving a stale PDF for 24h.
function getCachePath(invoiceId: string, versionKey: string): string {
  const hash = createHash('sha256').update(`${invoiceId}:${versionKey}`).digest('hex')
  return `invoices/${hash}.pdf`
}

async function getCachedSignedUrl(path: string): Promise<string | null> {
  if (!storageClient) return null
  const { data } = await storageClient.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  return data?.signedUrl ?? null
}

async function uploadPdf(path: string, buffer: Buffer): Promise<void> {
  if (!storageClient) return
  const { error } = await storageClient.storage
    .from(BUCKET_NAME)
    .upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '86400',
    })
  if (error) throw error
}

// ─── Routes ──────────────────────────────────────────────────────────────
export async function invoicePdfRoutes(fastify: FastifyInstance) {

  fastify.get<{ Params: { id: string } }>('/api/invoices/:id/pdf', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params
    const userId = (request as any).userId

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    if (!UUID_RE.test(id)) {
      return reply.code(400).send({ error: 'Invalid invoice id' })
    }

    // 1. Fetch invoice AND explicitly verify ownership.
    //    Do not rely on RLS alone — verify in application code too, since
    //    a shared/service-scoped client will not automatically filter by
    //    the requesting user.
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', id)
      .eq('user_id', userId) // ← ownership check (was missing)
      .single()

    if (error || !invoice) {
      return reply.code(404).send({ error: 'Invoice not found' })
    }

    // 2. Cache lookup — path is versioned by updated_at so edits invalidate
    //    the cache automatically.
    const versionKey = (invoice as any).updated_at || (invoice as any).created_at || 'v1'
    const cachePath = getCachePath(id, versionKey)

    const cachedUrl = await getCachedSignedUrl(cachePath)
    if (cachedUrl) {
      return reply.redirect(cachedUrl, 302)
    }

    try {
      // 3. Generate PDF
      const stream = await renderToStream(
        InvoicePDFDocument({ invoice: invoice as any })
      )

      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('error', (err: Error) => {
        fastify.log.error({ err, invoiceId: id }, 'PDF stream failed')
      })
      stream.on('end', async () => {
        try {
          await uploadPdf(cachePath, Buffer.concat(chunks))
        } catch (err) {
          fastify.log.error({ err, invoiceId: id }, 'PDF cache upload failed')
        }
      })

      reply.header('Content-Type', 'application/pdf')
      reply.header(
        'Content-Disposition',
        `attachment; filename="Invoice-${(invoice as any).invoice_number || id}.pdf"`
      )
      // Private financial document — do not let shared/CDN caches store it.
      reply.header('Cache-Control', 'private, max-age=3600')

      // Recommended: audit trail for financial-document access.
      // await logAuditEvent({ action: 'invoice_pdf_downloaded', invoiceId: id, userId })

      return reply.send(stream)
    } catch (err) {
      fastify.log.error({ err, invoiceId: id }, 'PDF generation failed')
      return reply.code(500).send({ error: 'PDF generation failed' })
    }
  })
}