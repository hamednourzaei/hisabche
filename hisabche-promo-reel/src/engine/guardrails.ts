// ============================================
// Hisabche Promo Reel Engine — Permanent Guardrails (Hard Rules 14-17)
// ============================================

export const MAX_ONSTAGE_WORDS = 6

export const BANNED_PERSIAN_FRAGMENTS: readonly string[] = [
  'بار گم',
  'آدرس بار',
  'بار رو بی‌تلفن پیدا کن',
  'تضمین ۱۰۰٪',
  'ضدجعل',
] as const

export interface ValidationResult {
  ok: boolean
  wordCount?: number
  error?: string | null
}

/**
 * Validates that on-stage non-subtitle text does not exceed 6 words.
 */
export function validateOnStageTextBudget(text: string): ValidationResult {
  if (!text) return { ok: true, wordCount: 0 }
  const words = text.trim().split(/\s+/).filter(Boolean)
  const count = words.length
  return {
    ok: count <= MAX_ONSTAGE_WORDS,
    wordCount: count,
    error:
      count > MAX_ONSTAGE_WORDS
        ? `Text budget exceeded: ${count} words (maximum allowed is ${MAX_ONSTAGE_WORDS})`
        : null,
  }
}

/**
 * Validates that on-screen copy does not use banned unnatural fragments.
 */
export function validateNaturalPersian(text: string): ValidationResult {
  if (!text) return { ok: true }
  for (const banned of BANNED_PERSIAN_FRAGMENTS) {
    if (text.includes(banned)) {
      return {
        ok: false,
        error: `Banned unnatural Persian fragment detected: "${banned}"`,
      }
    }
  }
  return { ok: true }
}

/**
 * Validates that on-stage titles do not duplicate spoken narration sentences.
 */
export function validateNoDuplicatedNarration(stageText: string, voText: string): ValidationResult {
  if (!stageText || !voText) return { ok: true }
  const sNorm = stageText.replace(/[.,،؛!?؟]/g, '').trim()
  const vNorm = voText.replace(/[.,،؛!?؟]/g, '').trim()
  if (vNorm.includes(sNorm) && sNorm.length > 10) {
    return {
      ok: false,
      error: `Stage text duplicates spoken voiceover narration: "${stageText}"`,
    }
  }
  return { ok: true }
}
