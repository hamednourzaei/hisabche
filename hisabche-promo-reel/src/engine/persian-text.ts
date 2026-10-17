// ============================================
// Hisabche Studio — Persian Text Normalization Engine
//
// Normalizes Persian/Dari text for robust acoustic speech
// matching, word-level forced alignment, and teleprompter display.
// ============================================

/**
 * Normalizes Persian characters for phonetic/ASR comparison
 * without affecting original display text.
 */
export function normalizePersianWord(
  rawWord: string,
  options: { stripZwnj?: boolean; stripDigits?: boolean } = {},
): string {
  if (!rawWord) return ''

  let text = rawWord.trim().normalize('NFC')

  // 1. Replace Arabic Yeh with Persian Yeh
  text = text.replace(/[\u0649\u064A\u06D2]/g, '\u06CC') // ى, ي, ے -> ی

  // 2. Replace Arabic Kaf with Persian Keheh
  text = text.replace(/\u0643/g, '\u06A9') // ك -> ک

  // 3. Replace Teh Marbuta with Heh
  text = text.replace(/\u0629/g, '\u0647') // ة -> ه

  // 4. Normalize Alef variants
  text = text.replace(/[\u0622\u0623\u0625]/g, '\u0627') // آ, أ, إ -> ا

  // 5. Normalize Heh / Hamza variants
  text = text.replace(/\u0624/g, '\u0648') // ؤ -> و
  text = text.replace(/\u0626/g, '\u06CC') // ئ -> ی

  // 6. Strip Tatweel / Kashida
  text = text.replace(/\u0640/g, '')

  // 7. Strip Persian / Arabic Harakat (Fatha, Damma, Kasra, Tanween, Tashdeed, Sukun)
  text = text.replace(/[\u064B-\u065F\u0670]/g, '')

  // 8. Convert Eastern Arabic/Persian digits to ASCII
  text = text.replace(/[۰٠]/g, '0')
  text = text.replace(/[۱١]/g, '1')
  text = text.replace(/[۲٢]/g, '2')
  text = text.replace(/[۳٣]/g, '3')
  text = text.replace(/[۴٤]/g, '4')
  text = text.replace(/[۵٥]/g, '5')
  text = text.replace(/[۶٦]/g, '6')
  text = text.replace(/[۷٧]/g, '7')
  text = text.replace(/[۸٨]/g, '8')
  text = text.replace(/[۹٩]/g, '9')

  // 9. Strip punctuation
  text = text.replace(/[،.؟!…:;«»""'()\[\]\-\/\\—_]/g, '')

  // 10. Optional ZWNJ stripping for loose alignment
  if (options.stripZwnj) {
    text = text.replace(/\u200C/g, '')
  }

  return text.trim()
}

/**
 * Checks whether two Persian tokens match semantically,
 * tolerating common morphological clitics and affixes (می, ها, ات, ی).
 */
export function persianWordsMatch(w1: string, w2: string): boolean {
  const n1 = normalizePersianWord(w1, { stripZwnj: true })
  const n2 = normalizePersianWord(w2, { stripZwnj: true })

  if (n1 === n2) return true
  if (n1.length === 0 || n2.length === 0) return false

  // Direct prefix/suffix variations (e.g. می‌کنه vs میکنه, مشتری‌ها vs مشتریها)
  if (n1.startsWith(n2) || n2.startsWith(n1)) {
    const diff = Math.abs(n1.length - n2.length)
    return diff <= 3
  }

  return false
}

/**
 * Tokenizes a Persian script sentence into display tokens while preserving
 * punctuation clues for teleprompter and timing analysis.
 */
export function tokenizePersianSentence(sentence: string): string[] {
  if (!sentence) return []
  return sentence.trim().split(/\s+/).filter(Boolean)
}
