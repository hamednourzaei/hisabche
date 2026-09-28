// ============================================
// packages/ui/src/lib/evidence-labels.ts
//
// Where a cost came from (cost_layers.source_type) or went (consumer_type),
// in words. A CLOSED list: t() throws on a missing key, and these values come
// from the database — an unknown one is shown as its code, never looked up.
// ============================================

export const EVIDENCE_SOURCE_TYPES = [
  'purchase',
  'purchase_order',
  'opening',
  'adjustment',
  'production',
  'reversal',
  'invoice',
  'transfer',
  'return',
  'csv',
  'manual',
] as const

export function evidenceSourceLabel(t: (key: string) => string, type: string): string {
  return (EVIDENCE_SOURCE_TYPES as readonly string[]).includes(type)
    ? t(`evidence.source.${type}`)
    : type
}
