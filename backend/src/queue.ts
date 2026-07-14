// ============================================
// backend/src/queue.ts — In-Process Async Queue
// ============================================

type JobHandler = (data: any) => Promise<void>

interface QueueJob {
  id: string
  type: string
  data: any
  handler: JobHandler
}

class InProcessQueue {
  private queues: Map<string, QueueJob[]> = new Map()
  private processing = false

  async add(type: string, data: any, handler: JobHandler): Promise<void> {
    const job: QueueJob = {
      id: `${type}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      type,
      data,
      handler,
    }

    const existing = this.queues.get(type) || []
    existing.push(job)
    this.queues.set(type, existing)

    // Process async — non-blocking
    this.process().catch(err => console.error('Queue process error:', err))
  }

  private async process(): Promise<void> {
    if (this.processing) return
    this.processing = true

    try {
      for (const [type, jobs] of this.queues) {
        while (jobs.length > 0) {
          const job = jobs.shift()
          if (!job) break

          try {
            console.log(`📦 Processing job: ${job.id} (${job.type})`)
            await job.handler(job.data)
            console.log(`✅ Job completed: ${job.id}`)
          } catch (err) {
            console.error(`❌ Job failed: ${job.id}`, err)
          }
        }
        this.queues.delete(type)
      }
    } finally {
      this.processing = false
    }
  }
}

export const asyncQueue = new InProcessQueue()

// ═══════════════════════════════════════════
// Job Types
// ═══════════════════════════════════════════

export async function queuePDFGeneration(invoiceId: string, userId: string) {
  const { supabase } = await import('./db')
  const { renderToStream } = await import('@react-pdf/renderer')
  const InvoicePDFDocument = (await import('./pdf/InvoicePDFDocument')).default

  asyncQueue.add('pdf', { invoiceId, userId }, async (data) => {
    console.log(`📄 Generating PDF for invoice ${data.invoiceId}`)
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', data.invoiceId)
      .single()

    if (!invoice) return

    const stream = await renderToStream(InvoicePDFDocument({ invoice }))
    // Save to storage or send to client
    console.log(`✅ PDF generated for invoice ${data.invoiceId}`)
  })
}

export async function queueEmail(to: string, subject: string, html: string) {
  const { emailService } = await import('./services/email.service')

  asyncQueue.add('email', { to, subject, html }, async (data) => {
    console.log(`📧 Sending email to ${data.to}`)
    await emailService.send(data)
  })
}

export async function queueReport(type: string, userId: string, params: any) {
  asyncQueue.add('report', { type, userId, params }, async (data) => {
    console.log(`📊 Generating report: ${data.type} for user ${data.userId}`)
    // Report generation logic
  })
}