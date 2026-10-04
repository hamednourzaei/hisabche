// ============================================
// backend/src/services/ingest/ingest.service.ts
//
// Capabilities #16 #30 #48 #49 — reading a photographed receipt or bill.
//
// Two steps, and a person stands between them:
//
//   read     a picture → a DRAFT: what the model read, how sure it was, and
//            what it could not place. NOTHING IS WRITTEN.
//   confirm  the draft AS THE PERSON CORRECTED IT → one purchase invoice,
//            issued by `InvoiceService.create` like every other purchase.
//
// The gates are the domain's (`checkIngestable`, `toDraft`, `isConfirmable`).
// This file supplies the provider and parses its answer.
//
// ⚠️ THE PROVIDER IS THE ONE CONFIGURED AI PROVIDER, through the one client.
// Not configured = `NO_PROVIDER`, said out loud — never an empty draft.
//
// ⚠️ THE MODEL STATES WHAT IT SEES, AS TEXT. The amount arrives as the string
// printed on the paper («۱۲۵٬۰۰۰») and is parsed HERE by a strict parser. A
// string that is not plainly a number is «unreadable», not zero.
//
// ⚠️ `confirm` TRUSTS NOTHING FROM `read`. It takes the figures the person sent
// after looking at them; the draft is not stored and cannot be replayed into
// the books by itself.
//
// ⚠️ THE PICTURE IS NOT KEPT. It is sent to the provider and dropped; the usage
// row records that a document was read, its type and size — not its contents.
//
// ⚠️ PICTURES ONLY, ONE PAGE. A PDF needs a page count and a text-layer check
// this deployment cannot do, so it is refused by name rather than half-read.
// ============================================

import { z } from 'zod'
import { CURRENCY_CODES, createInvoiceSchema, type CreateInvoice } from '@hisabche/validation'

import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { sourceIdOf } from '../../utils/deterministic-id'
import { minor } from '../../utils/money'
import { AiQuotaService, type QuotaStatus } from '../ai/ai-quota.service'
import { AiSettingsService, type AiProviderConfig } from '../ai/ai-settings.service'
import { callProvider } from '../ai/provider-client'
import { InvoiceService } from '../invoice.service'
import type { TenancyContext } from '../tenancy.service'
import {
  checkIngestable,
  isConfirmable,
  toDraft,
  type Confidence,
  type DocumentKind,
  type ExtractedDocument,
  type ExtractedField,
  type IngestVerdict,
} from './ingest.domain'

/** What this deployment can hand to a vision model. */
export const READABLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
/** 4 MB of picture: about 5.4 MB of base64, inside the server's body limit. */
export const READABLE_MAX_BYTES = 4 * 1024 * 1024

const KINDS: readonly DocumentKind[] = [
  'invoice',
  'receipt',
  'bank_statement',
  'delivery_note',
  'unknown',
]

export const READING_PROMPT = [
  'You are reading ONE photographed business document (a receipt, a bill or an invoice).',
  'Reply with a single JSON object and nothing else. Copy what is printed; do not calculate, convert or guess.',
  'Shape:',
  '{',
  '  "kind": "invoice" | "receipt" | "bank_statement" | "delivery_note" | "unknown",',
  '  "total": { "text": "<the grand total exactly as printed, digits and separators only>", "confidence": "high" | "medium" | "low" } | null,',
  '  "tax": { "text": "<as printed>", "confidence": … } | null,',
  '  "currency": { "text": "<ISO code if printed or unmistakable, e.g. AFN, USD, IRR>", "confidence": … } | null,',
  '  "documentNumber": { "text": "<as printed>", "confidence": … } | null,',
  '  "issuedOn": { "text": "<the date exactly as printed>", "confidence": … } | null,',
  '  "supplierName": { "text": "<the seller or issuer as printed>", "confidence": … } | null,',
  '  "unrecognisedLines": ["<any other line you could read but not place>", …]',
  '}',
  'Use null for anything that is not on the document or that you cannot read. Use "low" when you are unsure.',
].join('\n')

const read = z
  .object({
    text: z.string().trim().min(1).max(200),
    confidence: z.enum(['high', 'medium', 'low']),
  })
  .nullable()
  .optional()

const replySchema = z.object({
  kind: z.string().optional(),
  total: read,
  tax: read,
  currency: read,
  documentNumber: read,
  issuedOn: read,
  supplierName: read,
  unrecognisedLines: z.array(z.string().max(300)).max(60).optional(),
})

const DIGITS: Record<string, string> = {}
for (let index = 0; index < 10; index++) {
  DIGITS[String.fromCharCode(0x06f0 + index)] = String(index)
  DIGITS[String.fromCharCode(0x0660 + index)] = String(index)
}

/**
 * A printed amount → integer hundredths, or null when it is not plainly a number.
 *
 * ⚠️ STRICT ON PURPOSE. «125,000.50», «۱۲۵٬۰۰۰» and «125 000» are numbers.
 * «12.5.3», «1O5» and «about 500» are not, and are refused rather than read
 * as something: a wrong total is worse than no total.
 */
export function printedAmountToMinor(text: string): number | null {
  const ascii = [...text.trim()].map((char) => DIGITS[char] ?? char).join('')
  const plain = ascii.replace(/[,\u066C\u00A0\u202F\u0020]/g, '').replace(/\u066B/g, '.')
  if (!/^[0-9]+(\.[0-9]{1,3})?$/.test(plain)) return null
  const value = minor(Number(plain))
  return Number.isSafeInteger(value) ? value : null
}

/** The first JSON object in a reply, or null. A model sometimes wraps it in prose. */
function jsonObjectIn(reply: string): unknown {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(reply.slice(start, end + 1))
  } catch {
    return null
  }
}

const field = <T>(value: T, confidence: Confidence, raw?: string): ExtractedField<T> => ({
  value,
  confidence,
  // This provider cannot say where on the page a value came from.
  region: null,
  ...(raw !== undefined ? { raw } : {}),
})

/**
 * The provider's reply → the domain's document, or null when there is no
 * readable total (which the caller reports as «unreadable», never as zero).
 */
export function documentFromReply(
  reply: string,
  provider: { name: string; version: string },
): { document: ExtractedDocument; currency: string | null } | null {
  const parsed = replySchema.safeParse(jsonObjectIn(reply))
  if (!parsed.success || !parsed.data.total) return null

  const data = parsed.data
  const totalMinor = printedAmountToMinor(data.total!.text)
  if (totalMinor === null || totalMinor <= 0) return null

  const taxMinor = data.tax ? printedAmountToMinor(data.tax.text) : null
  const code = data.currency?.text.trim().toUpperCase() ?? ''
  const kind = KINDS.find((known) => known === data.kind) ?? 'unknown'
  const text = (value: z.infer<typeof read>) =>
    value ? field(value.text, value.confidence) : undefined

  return {
    document: {
      kind,
      fields: {
        totalMinor: field(totalMinor, data.total!.confidence, data.total!.text),
        taxMinor:
          data.tax && taxMinor !== null
            ? field(taxMinor, data.tax.confidence, data.tax.text)
            : undefined,
        documentNumber: text(data.documentNumber),
        issuedOn: text(data.issuedOn),
        supplierName: text(data.supplierName),
        unrecognisedLines: data.unrecognisedLines ?? [],
      },
      pagesRead: 1,
      provider,
    },
    // Only a code the product knows; anything else is not offered as a guess.
    currency: (CURRENCY_CODES as readonly string[]).includes(code) ? code : null,
  }
}

export const confirmInputSchema = z.object({
  /** Made once by the client per reviewed draft: a retry issues one invoice. */
  requestId: z.string().uuid(),
  supplierId: z.string().uuid(),
  currency: z.enum(CURRENCY_CODES as unknown as [string, ...string[]]),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** The total as the person confirmed it, in `currency`. */
  total: z.number().positive().max(1_000_000_000_000),
  /** What the line on the purchase invoice says. */
  description: z.string().trim().min(1).max(120),
  documentNumber: z.string().trim().max(80).nullable().default(null),
})

export interface ReadResult {
  verdict: IngestVerdict
  /** Whether the draft may be offered for confirmation, and why not. */
  confirmable: { ok: boolean; reason: string | null } | null
  /** A currency printed on the document, when it is one the product knows. */
  currency: string | null
  quota: QuotaStatus
}

export interface IngestInvoiceCreator {
  create: InvoiceService['create']
}

export class DocumentIngestService {
  constructor(
    private readonly settings: {
      getConfig(): Promise<AiProviderConfig | null>
    } = new AiSettingsService(),
    private readonly quota: {
      status(ctx: TenancyContext): Promise<QuotaStatus>
    } = new AiQuotaService(),
    private readonly call: typeof callProvider = callProvider,
    private readonly invoices: IngestInvoiceCreator = new InvoiceService(),
  ) {}

  /** Read one picture into a draft. Writes nothing but the usage row. */
  async read(
    ctx: TenancyContext,
    input: { contentType: string; base64: string },
  ): Promise<ReadResult> {
    const config = await this.settings.getConfig()
    const quota = await this.quota.status(ctx)
    const refuse = (verdict: IngestVerdict): ReadResult => ({
      verdict,
      confirmable: null,
      currency: null,
      quota,
    })

    // Bytes of the picture, not characters of its encoding.
    const byteLength = Math.floor((input.base64.replace(/=+$/, '').length * 3) / 4)
    const checked = checkIngestable({
      contentType: input.contentType,
      byteLength,
      pageCount: 1,
      hasTextLayer: false,
      availability: { configured: config !== null },
    })
    if (!('ok' in checked)) return refuse(checked)

    if (!(READABLE_IMAGE_TYPES as readonly string[]).includes(input.contentType)) {
      return refuse({
        kind: 'refused',
        reason: 'UNSUPPORTED_TYPE',
        detail: `${input.contentType} cannot be read here — take a picture (JPEG, PNG or WebP)`,
      })
    }
    if (byteLength > READABLE_MAX_BYTES) {
      return refuse({
        kind: 'refused',
        reason: 'TOO_LARGE',
        detail: `${byteLength} bytes exceeds the ${READABLE_MAX_BYTES} limit for a picture`,
      })
    }
    if (!/^[A-Za-z0-9+/]+=*$/.test(input.base64)) {
      throw new ValidationError('INGEST_NOT_BASE64')
    }
    if (quota.remaining <= 0) throw new ValidationError('AI_QUOTA_EXCEEDED')

    const started = Date.now()
    const reply = await this.call(config!, {
      system: READING_PROMPT,
      user: 'Read this document.',
      maxTokens: 1500,
      image: { mediaType: input.contentType, base64: input.base64 },
    })

    const extracted = documentFromReply(reply, { name: config!.provider, version: config!.model })
    const verdict: IngestVerdict = extracted
      ? toDraft(extracted.document, 1)
      : { kind: 'unreadable', reason: 'TOTAL_NOT_FOUND' }

    await this.log(ctx, config!, {
      contentType: input.contentType,
      byteLength,
      outcome: verdict.kind,
      latencyMs: Date.now() - started,
    })

    return {
      verdict,
      confirmable: extracted ? isConfirmable(extracted.document) : null,
      currency: extracted?.currency ?? null,
      quota: await this.quota.status(ctx),
    }
  }

  /**
   * Record the document the person reviewed as ONE purchase invoice from the
   * supplier they chose. The figures are theirs, not the model's.
   */
  async confirm(ctx: TenancyContext, raw: unknown): Promise<{ invoiceId: string }> {
    const input = confirmInputSchema.parse(raw)
    if (!(minor(input.total) > 0)) throw new ValidationError('INGEST_TOTAL_TOO_SMALL')

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.supplierId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the supplier', error)
    if (!supplier) throw new NotFoundError('Supplier')

    const body = createInvoiceSchema.parse({
      type: 'purchase',
      date: `${input.issuedOn}T00:00:00.000Z`,
      supplierId: input.supplierId,
      currency: input.currency,
      items: [
        {
          productName: input.description,
          quantity: 1,
          unitPrice: input.total,
          totalPrice: input.total,
        },
      ],
      subtotal: input.total,
      total: input.total,
      paidAmount: 0,
      ...(input.documentNumber ? { reference: input.documentNumber } : {}),
    }) as CreateInvoice

    const created = (await this.invoices.create(ctx, body, null, {
      clientRequestId: sourceIdOf(ctx.workspaceId, 'ingested_document', input.requestId),
    })) as { id?: string } | null
    if (!created?.id) throw new DatabaseError('The purchase invoice was not created', {})
    return { invoiceId: created.id }
  }

  /** One row in the AI log (which is also the allowance counter). No contents. */
  private async log(
    ctx: TenancyContext,
    config: AiProviderConfig,
    entry: { contentType: string; byteLength: number; outcome: string; latencyMs: number },
  ): Promise<void> {
    const { error } = await supabase.from('ai_query_log').insert({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.userId,
      question_text: `[document reading, ${entry.contentType}, ${entry.byteLength} bytes]`,
      answer_text: `[${entry.outcome}]`,
      resolved_views_or_functions: [],
      model_provider: config.provider,
      model_name: config.model,
      latency_ms: entry.latencyMs,
    })
    if (error) console.error('[DocumentIngestService] failed to write ai_query_log:', error)
  }
}

export const documentIngestService = new DocumentIngestService()
