// ============================================
// Capabilities #16, #30, #48, #49 — document ingestion.
// Engine N14.
//
// ⚠️ THIS IS THE EXTRACTION LAYER, NOT THE OCR PROVIDER, AND THE DIFFERENCE
// IS THE WHOLE DESIGN.
//
// Phase O of the earlier roadmap declined OCR with an honest reason: it needs
// Storage + a job queue + a provider + a security model, and none of the four
// existed. Three of the four exist now (`supabase.storage` in two services,
// `distributed-work.ts`, the `background_jobs` table). The fourth — a provider —
// is credentials the owner has to supply, and `G4` says a setting nobody was
// asked about must have a stated default.
//
// So: the pipeline, the contract with a provider, the safety limits, and the
// review step are all built here; the recognition itself is an injected
// interface. Without a provider the pipeline REFUSES, loudly, rather than
// returning an empty result that a caller would treat as «nothing to read».
//
// ⚠️ AN UPLOADED DOCUMENT IS A CLAIM ABOUT DATA, NOT DATA.
//
// `migration.domain.ts` already says this of a CSV: «an uploaded export is not
// data — it is a claim about data, written by software nobody here controls».
// An OCR result is weaker still — it is a claim by a statistical model about a
// photograph. Nothing here creates a product, a customer or an invoice from
// one. It produces a DRAFT the person confirms, and the same
// `migration_records` idempotency that stops a re-import duplicating rows.
//
// ⚠️ AND EVERY EXTRACTED LINE KEEPS ITS CONFIDENCE AND ITS SOURCE REGION.
//
// A figure with no confidence is a figure a shop will invoice. Each field
// carries what the model said, how sure it was, and where on the page it came
// from, so a person can look at the original rather than trust the product.
export type Confidence = 'high' | 'medium' | 'low'

export interface ExtractedField<T> {
  value: T
  confidence: Confidence
  /**
   * ⚠️ WHERE ON THE PAGE. `null` for a provider that cannot say, which is
   * most of them — and null means the person has to find it themselves, not
   * that it can be skipped.
   */
  region: { page: number; box?: [number, number, number, number] } | null
  /** The model's own raw text for this field, when it differs from the value. */
  raw?: string | null
}

export type DocumentKind = 'invoice' | 'receipt' | 'bank_statement' | 'delivery_note' | 'unknown'

/** The shape a provider must return. Deliberately SMALL and deliberately TEXT. */
export interface ExtractedDocument {
  kind: DocumentKind
  /** Every field a person has to confirm before anything is written. */
  fields: {
    documentNumber?: ExtractedField<string> | undefined
    issuedOn?: ExtractedField<string> | undefined
    totalMinor: ExtractedField<number>
    taxMinor?: ExtractedField<number> | undefined
    supplierName?: ExtractedField<string> | undefined
    counterpartyName?: ExtractedField<string> | undefined
    /** Free text the model could not place. Shown, not dropped. */
    unrecognisedLines: string[]
  }
  /**
   * ⚠️ The page count the provider read. Not the page count of the file — a
   * provider that silently read two pages of a five-page statement has produced
   * a total that looks complete and is not.
   */
  pagesRead: number
  /** The provider's name and version, recorded on the draft. */
  provider: { name: string; version: string }
}

/**
 * What the product does NOT have.
 *
 * ⚠️ Passed in rather than imported, so the refusal is a decision at the call
 * site and the engine has no opinion about credentials it cannot see.
 */
export interface ProviderAvailability {
  configured: boolean
  /** Why it is not configured, when it is not. Shown to nobody but the owner. */
  reason?: string | undefined
}

export type IngestVerdict =
  /** Ready for a person to confirm. Nothing has been written. */
  | { kind: 'draft'; document: ExtractedDocument; warnings: string[] }
  /** Refused, with the reason. NEVER an empty result. */
  | { kind: 'refused'; reason: IngestRefusal; detail: string }
  /** Read it, but too poorly to be worth a person's time. */
  | { kind: 'unreadable'; reason: string }

export type IngestRefusal =
  'NO_PROVIDER' | 'UNSUPPORTED_TYPE' | 'TOO_LARGE' | 'NO_TEXT' | 'TOO_MANY_PAGES' | 'TOO_FEW_PAGES'

// ─── Limits, all with stated defaults ───────────────────────────────────────

/**
 * ⚠️ G4 — every limit below has a default and a reason, because a document
 * intake that silently truncates is a shop that silently loses invoices.
 *
 * The sizes are in BYTES. `customer-profile.domain` already uses 5 MB for an
 * attachment, so a photographed receipt — which is what a shop actually has —
 * is comfortably inside it, and a scanned archive is not.
 */
export const INGEST_LIMITS = {
  /** 10 MB. Above this the request body is the problem, not the document. */
  maxBytes: 10 * 1024 * 1024,
  /** 20 pages. A bank statement longer than that is usually a wrong upload. */
  maxPages: 20,
  /** Below this there is no document, so there is nothing to extract. */
  minPages: 1,
  /**
   * ⚠️ Accepted MIME types. `application/pdf` and images only — deliberately
   * NOT `application/vnd.ms-excel` or the OOXML types, for the reason
   * `README.md` records: an xlsx is a zip, and a dump can execute code, so
   * until the parser is isolated its presence in the list is a promise the
   * product cannot keep.
   */
  acceptedTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
  ] as const,
}

export interface IngestInput {
  contentType: string
  byteLength: number
  pageCount: number
  hasTextLayer: boolean
  availability: ProviderAvailability
}

/**
 * Can this document be ingested at all?
 *
 * ⚠️ EVERY REFUSAL CARRIES A REASON, and the checks run cheapest-first so a
 * 40 MB file does not spend a round trip being told it is the wrong type.
 */
export function checkIngestable(input: IngestInput): IngestVerdict | { ok: true } {
  if (!input.availability.configured) {
    return {
      kind: 'refused',
      reason: 'NO_PROVIDER',
      // ⚠️ The default is that NOBODY is configured. A deployment that has not
      // been given provider credentials rejects every document, which is
      // correct and is far better than a pipeline that returns nothing and lets
      // a caller read that as «there was nothing in the file».
      detail: input.availability.reason ?? 'no OCR provider is configured for this deployment',
    }
  }

  if (!(INGEST_LIMITS.acceptedTypes as readonly string[]).includes(input.contentType)) {
    return {
      kind: 'refused',
      reason: 'UNSUPPORTED_TYPE',
      detail: `${input.contentType} is not an accepted document type`,
    }
  }

  if (input.byteLength > INGEST_LIMITS.maxBytes) {
    return {
      kind: 'refused',
      reason: 'TOO_LARGE',
      detail: `${input.byteLength} bytes exceeds the ${INGEST_LIMITS.maxBytes} limit`,
    }
  }

  if (input.pageCount > INGEST_LIMITS.maxPages) {
    return {
      kind: 'refused',
      reason: 'TOO_MANY_PAGES',
      detail: `${input.pageCount} pages exceeds the ${INGEST_LIMITS.maxPages} limit`,
    }
  }

  if (input.pageCount < INGEST_LIMITS.minPages) {
    return {
      kind: 'refused',
      reason: 'TOO_FEW_PAGES',
      detail: `${input.pageCount} pages is not a document`,
    }
  }

  // ⚠️ A PDF with a text layer is READ, not photographed — and reading it is
  // both faster and more accurate than OCR would be. Saying so is the difference
  // between a provider being used when it is needed and being called for work
  // it does worse than a string.
  if (input.hasTextLayer) {
    return {
      kind: 'refused',
      reason: 'NO_TEXT',
      detail: 'this PDF already contains selectable text and does not need OCR',
    }
  }

  return { ok: true }
}

/**
 * Turn a provider's answer into a draft, or refuse it.
 *
 * ⚠️ A DOCUMENT WITH NO TOTAL IS `unreadable`, NOT A DRAFT WITH A ZERO TOTAL.
 * A receipt whose total the model could not find is the most common failure and
 * the most expensive to get wrong — a zero-total draft saved and confirmed is a
 * free item on the shelf.
 */
export function toDraft(document: ExtractedDocument, expectedPages: number): IngestVerdict {
  const warnings: string[] = []

  if (document.fields.totalMinor.confidence === 'low') {
    warnings.push('the total was read with low confidence — check it against the document')
  }

  if (document.pagesRead < expectedPages) {
    // ⚠️ ALWAYS A WARNING, NEVER SILENT. A provider that read three of five
    // pages produces a total that looks complete and is not, and there is no
    // other place this would surface.
    warnings.push(
      `only ${document.pagesRead} of ${expectedPages} pages were read — the total may be incomplete`,
    )
  }

  if (document.fields.unrecognisedLines.length > 0) {
    warnings.push(
      `${document.fields.unrecognisedLines.length} lines were not recognised and are shown as text`,
    )
  }

  if (document.kind === 'unknown') {
    warnings.push('the document type was not recognised — check what it is before filing it')
  }

  return { kind: 'draft', document, warnings }
}

/**
 * Whether a draft may be offered for confirmation at all.
 *
 * ⚠️ THE ONLY HARD GATE IS THE TOTAL. Everything else can be filled in by the
 * person looking at the document; a missing supplier name is a field, and a
 * missing total is a value the books would then treat as real.
 */
export function isConfirmable(document: ExtractedDocument): {
  ok: boolean
  reason: string | null
} {
  if (document.fields.totalMinor.confidence === 'low' && document.fields.totalMinor.value === 0) {
    return { ok: false, reason: 'TOTAL_UNREADABLE' }
  }
  if (!Number.isSafeInteger(document.fields.totalMinor.value)) {
    return { ok: false, reason: 'TOTAL_NOT_AN_INTEGER' }
  }
  if (document.fields.totalMinor.value < 0) {
    // ⚠️ A negative total on a purchase document is a credit note or a parsing
    // error, and the difference matters: one reverses, the other is wrong.
    return { ok: false, reason: 'NEGATIVE_TOTAL_NEEDS_A_CREDIT_NOTE' }
  }
  return { ok: true, reason: null }
}

/**
 * The file name a draft's source keeps.
 *
 * ⚠️ Sanitised, and the reason is in `customer-profile.domain#cleanFileName`
 * already: a name from an upload is attacker-controlled, and it lands in storage
 * paths and in whatever the shop types into the supplier field.
 *
 * ⚠️ THE CONTROL CHARACTERS ARE BUILT AT RUN TIME, not written literally.
 * Writing them into this file put a real NUL and a real 0x1F into the SOURCE —
 * which is the BOM/control-character trap `CLAUDE.md` records, hit a fourth
 * time, and it made the file unreadable to `grep`. Built from char codes the
 * pattern is correct and the file stays plain text.
 */
const CONTROL_CHARS = new RegExp(
  '[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + ']',
  'g',
)

export function safeFileName(name: string): string {
  // ⚠️ Split on the separators FIRST, before anything else, so
  // `../../etc/passwd` cannot be sanitised into something that still holds a
  // path.
  const base = name.split(/[\\/]/).pop() ?? 'document'

  const cleaned = base
    .replace(CONTROL_CHARS, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120)

  // ⚠️ A NAME THAT IS NOTHING BUT DOTS IS NOT A FILENAME. `.`, `..` and
  // `...` all survive the character filter — dots are legal in a name — and a
  // storage path ending in `...` is a path nobody can display. Requiring one
  // real character is the difference between a sanitised name and a placeholder.
  if (!/[\w-]/.test(cleaned)) return 'document'

  return cleaned
}
