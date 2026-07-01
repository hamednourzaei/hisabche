// ============================================
// backend/src/queue/pdf-queue.ts
// BullMQ Queue for PDF generation
// ============================================

import { Queue, Worker, Job } from 'bullmq'
import { createHash } from 'crypto'
import { renderToStream } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import InvoicePDFDocument from '../pdf/InvoicePDFDocument'

// ─── Redis Connection ─────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const connection = { url: REDIS_URL }

// Supabase Storage ─────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const BUCKET_NAME = 'pdf-cache'

// Ensure bucket exists (run once)
supabase.storage.getBucket(BUCKET_NAME).catch(() => {
  supabase.storage.createBucket(BUCKET_NAME, { public: true })
})

// ─── Queue ────────────────────────────────────────────
export const pdfQueue = new Queue('pdf-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
})

// ─── Job Data Type ────────────────────────────────────
interface PdfJobData {
  invoiceId: string
  invoice: any
}

// ─── Helper: Upload to Supabase Storage ───────────────
async function uploadToStorage(invoiceId: string, buffer: Buffer): Promise<string> {
  const hash = createHash('md5').update(JSON.stringify(invoiceId)).digest('hex')
  const fileName = `invoices/${hash}.pdf`

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '86400',
    })

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName)

  return urlData.publicUrl
}

// ─── Worker ───────────────────────────────────────────
const worker = new Worker<PdfJobData>(
  'pdf-generation',
  async (job: Job<PdfJobData>) => {
    const { invoiceId, invoice } = job.data

    // Update progress
    await job.updateProgress(10)

    // Generate PDF
    const stream = await renderToStream(
      InvoicePDFDocument({ invoice })
    )

    await job.updateProgress(50)

    // Collect chunks
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    await job.updateProgress(80)

    // Upload to Supabase Storage
    const buffer = Buffer.concat(chunks)
    const publicUrl = await uploadToStorage(invoiceId, buffer)

    await job.updateProgress(100)

    return { url: publicUrl }
  },
  {
    connection,
    concurrency: 3,
    autorun: true,
  }
)

// ─── Worker Events ────────────────────────────────────
worker.on('completed', (job) => {
  console.log(`PDF job ${job.id} completed: ${job.returnvalue?.url}`)
})

worker.on('failed', (job, err) => {
  console.error(`PDF job ${job?.id} failed:`, err.message)
})

// ─── Helper: Check if PDF exists in storage ───────────
export async function getCachedPdfUrl(invoiceId: string): Promise<string | null> {
  const hash = createHash('md5').update(JSON.stringify(invoiceId)).digest('hex')
  const fileName = `invoices/${hash}.pdf`

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(fileName, 3600) // 1 hour signed URL

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

// ─── Helper: Add job to queue ─────────────────────────
export async function enqueuePdfJob(invoiceId: string, invoice: any): Promise<string> {
  const job = await pdfQueue.add(`pdf-${invoiceId}`, {
    invoiceId,
    invoice,
  })
  return job.id!
}