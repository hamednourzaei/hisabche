// ============================================
// Hisabche Motion Design Studio — /new-reels Automated CLI Studio
//
// Command-line generator executing the 7-phase /new-reels protocol:
// 1. Merchant persona & pain extraction
// 2. Opening archetype selection (6 strategies)
// 3. Layout topology & art direction cyclic rotation
// 4. Purposeful 5-6 operator selection
// 5. Creative similarity validation (<= 35% threshold)
// 6. Code generation & ledger logging
// 7. Automated compilation & verification
// ============================================

export const OPENING_ARCHETYPES = [
  'immediate-consequence',
  'uncomfortable-discovery',
  'customer-confrontation',
  'visual-pattern-interrupt',
  'quiet-dread',
  'deadline-pressure',
]

export const ART_DIRECTIONS = [
  'cinematic-obsidian',
  'swiss-editorial',
  'kinetic-manifesto',
  'procedural-spatial',
  'financial-intelligence',
]

export const LAYOUT_TOPOLOGIES = [
  'split-screen-horizon',
  'asymmetrical-swiss-grid',
  'full-bleed-kinetic',
  'spatial-2.5d-portal',
  'data-flow-matrix',
]

/**
 * Evaluates creative similarity between candidate entry and previous entry.
 */
export function evaluateSimilarity(candidate, previous) {
  let score = 0
  const reasons = []

  if (candidate.openingArchetype === previous.openingArchetype) {
    score += 0.25
    reasons.push(`Same archetype: ${candidate.openingArchetype}`)
  }
  if (candidate.layoutTopology === previous.layoutTopology) {
    score += 0.25
    reasons.push(`Same topology: ${candidate.layoutTopology}`)
  }
  if (candidate.artDirection === previous.artDirection) {
    score += 0.2
    reasons.push(`Same art direction: ${candidate.artDirection}`)
  }
  if (candidate.merchantPainCategory === previous.merchantPainCategory) {
    score += 0.15
    reasons.push(`Same pain: ${candidate.merchantPainCategory}`)
  }
  if (candidate.audioStrategy === previous.audioStrategy) {
    score += 0.1
    reasons.push(`Same audio: ${candidate.audioStrategy}`)
  }

  const prevOps = new Set(previous.operators || [])
  const common = (candidate.operators || []).filter((op) => prevOps.has(op))
  if (candidate.operators?.length && common.length / candidate.operators.length > 0.6) {
    score += 0.05
    reasons.push(`High operator overlap: ${common.length}`)
  }

  return { score, passed: score <= 0.35, reasons }
}

/**
 * Extracts structured metadata from a prompt string.
 */
export function extractMerchantStory(promptText) {
  const p = promptText.toLowerCase()

  let targetCustomer = 'retail-shopkeeper'
  if (p.includes('بنکدار') || p.includes('عمده') || p.includes('wholesaler')) {
    targetCustomer = 'wholesaler'
  } else if (
    p.includes('تولید') ||
    p.includes('کارگاه') ||
    p.includes('کارخانه') ||
    p.includes('workshop')
  ) {
    targetCustomer = 'workshop-producer'
  } else if (
    p.includes('خدمات') ||
    p.includes('پیمانکار') ||
    p.includes('contractor') ||
    p.includes('service')
  ) {
    targetCustomer = 'services'
  } else if (p.includes('حسابدار') || p.includes('ممیز') || p.includes('مالیات')) {
    targetCustomer = 'accountant'
  }

  let pain = 'profit-illusion'
  let archetype = 'uncomfortable-discovery'
  if (p.includes('چک') || p.includes('بانک') || p.includes('سررسید')) {
    pain = 'cheque-domino-collapse'
    archetype = 'deadline-pressure'
  } else if (p.includes('نسیه') || p.includes('طلب') || p.includes('فاکتور')) {
    pain = 'untracked-receivables'
    archetype = 'customer-confrontation'
  } else if (
    p.includes('انبار') ||
    p.includes('مغایرت') ||
    p.includes('مفقود') ||
    p.includes('شعبه')
  ) {
    pain = 'inventory-discrepancy'
    archetype = 'immediate-consequence'
  } else if (p.includes('مالیات') || p.includes('دفتر دستی') || p.includes('علی‌الرأس')) {
    pain = 'tax-audit-penalties'
    archetype = 'quiet-dread'
  }

  return { targetCustomer, pain, archetype }
}

console.log('✓ Hisabche /new-reels Studio Generator loaded successfully.')
