// ============================================
// Hisabche Studio — Persian Optical Typography & Adaptive Layout Engine
//
// Solves:
// 1. Cramped text-in-boxes & broken card hierarchy
// 2. Single-word orphans via text-wrap: balance & max-width constraints
// 3. Persian script ascender/descender line-height safety (never leading-none)
// 4. Adaptive layout switching between side-by-side columns and stacked full-width cards
// ============================================

export type ContainerType = 'hero' | 'card-half' | 'card-full' | 'caption'

export interface OpticalFontConfig {
  fontSize: string
  lineHeight: number
  fontWeight: number
  letterSpacing?: string
}

/**
 * Computes optical font size and line height based on character count and container type.
 */
export function getOpticalFontSize(text: string, containerType: ContainerType): OpticalFontConfig {
  const len = text.trim().length

  if (containerType === 'card-half') {
    if (len <= 12) {
      return { fontSize: '22px', lineHeight: 1.5, fontWeight: 800 }
    }
    if (len <= 24) {
      return { fontSize: '18px', lineHeight: 1.55, fontWeight: 700 }
    }
    return { fontSize: '15px', lineHeight: 1.65, fontWeight: 600 }
  }

  if (containerType === 'card-full') {
    if (len <= 20) {
      return { fontSize: '24px', lineHeight: 1.5, fontWeight: 800 }
    }
    if (len <= 45) {
      return { fontSize: '19px', lineHeight: 1.6, fontWeight: 700 }
    }
    return { fontSize: '16px', lineHeight: 1.65, fontWeight: 600 }
  }

  if (containerType === 'hero') {
    if (len <= 20) {
      return { fontSize: '36px', lineHeight: 1.45, fontWeight: 900 }
    }
    if (len <= 40) {
      return { fontSize: '28px', lineHeight: 1.5, fontWeight: 800 }
    }
    return { fontSize: '22px', lineHeight: 1.55, fontWeight: 700 }
  }

  // caption / verdict
  if (len <= 30) {
    return { fontSize: '17px', lineHeight: 1.65, fontWeight: 700 }
  }
  return { fontSize: '15px', lineHeight: 1.75, fontWeight: 600 }
}

/**
 * Determines whether two comparison cards should switch from narrow side-by-side
 * columns (grid-cols-2) to stacked full-width horizontal cards (grid-cols-1).
 * Triggered if either card's primary text exceeds 18 characters or 3 words.
 */
export function shouldStackCards(textA: string, textB: string): boolean {
  const lenA = textA.trim().length
  const lenB = textB.trim().length
  const wordsA = textA.trim().split(/\s+/).length
  const wordsB = textB.trim().split(/\s+/).length

  return lenA > 18 || lenB > 18 || wordsA > 3 || wordsB > 3
}

/**
 * Splits a longer Persian card phrase into a punchy 2-3 word focal title
 * and an informative supporting subtitle.
 */
export function splitTitleSubtitle(text: string): { title: string; subtitle?: string } {
  const trimmed = text.trim()

  if (trimmed.length <= 18 && trimmed.split(/\s+/).length <= 3) {
    return { title: trimmed }
  }

  // Check common Persian delimiters
  const delims = [' + ', ' - ', ' | ', ' : ', '، ', '؛ ']
  for (const delim of delims) {
    if (trimmed.includes(delim)) {
      const parts = trimmed.split(delim)
      const first = parts[0]?.trim() || ''
      const rest = parts.slice(1).join(delim).trim()
      if (first.length > 0 && rest.length > 0) {
        return { title: first, subtitle: rest }
      }
    }
  }

  const words = trimmed.split(/\s+/)
  if (words.length >= 4) {
    // Choose 2 words for title if short, or up to 3 words
    const titleWords = words.slice(0, 2).join(' ').length <= 16 ? 2 : 2
    return {
      title: words.slice(0, titleWords).join(' '),
      subtitle: words.slice(titleWords).join(' '),
    }
  }

  return { title: trimmed }
}
