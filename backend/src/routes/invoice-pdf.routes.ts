// ============================================
// backend/src/routes/invoice-pdf.routes.ts
// FIXED: Consistent hash + private bucket enforcement
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { createHash } from 'crypto'
import { renderToStream } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import { supabase } from '../db'
import InvoicePDFDocument from '../pdf/InvoicePDFDocument'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'

// Same public share link the on-page QR/InvoiceQRCode encodes — falls back
// to the raw invoice id when public_token hasn't been migrated in yet
// (see docs/invoice-public-share-migration.sql).
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hisabche.com'
function buildShareUrl(invoiceId: string, publicToken?: string | null): string {
  return publicToken
    ? `${FRONTEND_URL}/af/public-invoice/${publicToken}`
    : `${FRONTEND_URL}/af/invoices/${invoiceId}`
}

// ─── Supabase Storage Client (service role — storage admin only) ──
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || ''

const storageClient = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

const BUCKET_NAME = 'pdf-cache'
const SIGNED_URL_TTL_SECONDS = 3600

// ─── Ensure bucket exists & is PRIVATE ────────────────
// ✅ FIX 1: هماهنگ با pdf-queue.ts
async function ensureBucket(): Promise<void> {
  if (!storageClient) return

  const { data: buckets, error } = await storageClient.storage.listBuckets()

  if (error) {
    console.error('❌ Failed to list buckets:', error.message)
    return
  }

  const exists = buckets?.some((b) => b.name === BUCKET_NAME)

  if (!exists) {
    console.log(`📦 Creating bucket: ${BUCKET_NAME} (private)`)
    const { error: createError } = await storageClient.storage.createBucket(BUCKET_NAME, {
      public: false,
    })

    if (createError) {
      console.error(`❌ Failed to create bucket: ${BUCKET_NAME}`, createError.message)
    } else {
      console.log(`✅ Bucket created: ${BUCKET_NAME} (private)`)
    }
    return
  }

  // ✅ اگر باکت از قبل وجود داشت، اطمینان از private بودن
  const bucket = buckets?.find((b) => b.name === BUCKET_NAME)
  if (bucket?.public) {
    console.warn(`⚠️  Bucket ${BUCKET_NAME} is PUBLIC — updating to PRIVATE...`)
    const { error: updateError } = await storageClient.storage.updateBucket(BUCKET_NAME, {
      public: false,
    })
    if (updateError) {
      console.error(`❌ Failed to update bucket visibility:`, updateError.message)
    } else {
      console.log(`✅ Bucket ${BUCKET_NAME} is now PRIVATE`)
    }
  }
}

// ─── اجرای ensureBucket در startup ──────────────────
ensureBucket().catch((err) => console.error('ensureBucket failed:', err))

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Helpers ───────────────────────────────────────
// ✅ FIX 2: هماهنگ با pdf-queue.ts — هر دو SHA-256
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
  const { error } = await storageClient.storage.from(BUCKET_NAME).upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: true,
    cacheControl: '86400',
  })
  if (error) throw error
}

// ─── Routes ────────────────────────────────────────

/**
 * The UI language behind an `Accept-Language` header.
 *
 * ⚠️ DELIBERATELY NARROW. It recognises the three languages this product
 * actually ships and returns Dari for everything else — the value only picks a
 * calendar and a numeral system, so a wrong guess is a cosmetic error, while
 * pulling in a full language-negotiation dependency for it would not be.
 *
 * `fa-AF` is checked BEFORE `fa`, or every Dari reader would be handed the
 * Iranian month names by a prefix match.
 */
function uiLanguageFromHeader(header: string | string[] | undefined): 'fa' | 'af' | 'en' {
  const value = (Array.isArray(header) ? header[0] : header)?.toLowerCase() ?? ''

  if (value.startsWith('fa-af') || value.startsWith('af')) return 'af'
  if (value.startsWith('fa')) return 'fa'
  if (value.startsWith('en')) return 'en'
  return 'af'
}

export async function invoicePdfRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    '/api/invoices/:id/pdf',
    {
      preHandler: [authenticate, requireWorkspaceContext],
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
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params
      const { workspaceId } = request.tenancy

      if (!UUID_RE.test(id)) {
        return reply.code(400).send({ error: 'Invalid invoice id' })
      }

      // 1. Fetch the invoice, scoped to the authorized workspace.
      //
      // An export endpoint is exactly where an ownership check gets skipped,
      // so it is spelled out: `.eq('id', id)` alone would render any invoice
      // on the platform to anyone who learned its id. The workspace filter is
      // what makes the id safe to accept from the client.
      //
      // It was `.eq('user_id', userId)`, which was also wrong in the other
      // direction under the shared-book model: a manager could not print an
      // invoice the owner had entered.
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .single()

      if (error || !invoice) {
        return reply.code(404).send({ error: 'Invoice not found' })
      }

      // 2. Cache lookup — SHA-256 hash (✅ هماهنگ با pdf-queue.ts)
      const versionKey = (invoice as any).updated_at || (invoice as any).created_at || 'v1'
      const cachePath = getCachePath(id, versionKey)

      const cachedUrl = await getCachedSignedUrl(cachePath)
      if (cachedUrl) {
        return reply.redirect(cachedUrl, 302)
      }

      // 3. Generate PDF + Upload (fire-and-forget)
      try {
        let qrDataUrl: string | null = null
        try {
          const shareUrl = buildShareUrl(id, (invoice as any).public_token)
          qrDataUrl = await QRCode.toDataURL(shareUrl, { margin: 1, width: 160 })
        } catch (qrErr) {
          fastify.log.error(
            { err: qrErr, invoiceId: id },
            'QR generation failed — continuing without it',
          )
        }

        // ⚠️ THE READER'S CALENDAR, NOT THE SERVER'S.
        //
        // The document used to be rendered with a hardcoded `'fa-AF'`, so an
        // English-speaking customer received an invoice dated in the Afghan
        // solar calendar with Persian digits. `Accept-Language` is what the
        // browser already sends on this exact request — the client does not
        // have to be changed to start being correct.
        //
        // An unrecognised or absent header falls through to Dari, which is
        // what every PDF produced so far already used, so nothing in the
        // archive changes meaning.
        const lang = uiLanguageFromHeader(request.headers['accept-language'])

        const stream = await renderToStream(
          InvoicePDFDocument({ invoice: invoice as any, qrDataUrl, lang }),
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
          `attachment; filename="Invoice-${(invoice as any).invoice_number || id}.pdf"`,
        )
        reply.header('Cache-Control', 'private, max-age=3600')

        return reply.send(stream)
      } catch (err) {
        fastify.log.error({ err, invoiceId: id }, 'PDF generation failed')
        return reply.code(500).send({ error: 'PDF generation failed' })
      }
    },
  )
}
