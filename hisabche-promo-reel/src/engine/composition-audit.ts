// ============================================
// Hisabche Promo Reel — Composition & Center-of-Gravity Audit (Hard Rule 11)
// Diagnostic helper ensuring primary scene content remains in the optical
// center (Y: 40%–60% of vertical canvas) and does not sink into the bottom third.
// ============================================

export interface CompositionAuditResult {
  contentTop: number
  contentBottom: number
  contentHeight: number
  contentCenterY: number
  relativeCenterY: number // 0.0 to 1.0 (relative to canvas height)
  isSafeCenter: boolean
  warning?: string
}

/**
 * Hard Rule 11: Validates that primary visual content is properly centered
 * and not crowded downward against the bottom teleprompter/caption bar.
 * In 540x960 canvas:
 * - Expected Center Y: between 400px (41.6%) and 560px (58.3%)
 * - Subtitle Zone: 770px - 900px
 */
export function auditComposition(
  contentTop: number,
  contentBottom: number,
  canvasHeight = 960,
): CompositionAuditResult {
  const contentHeight = Math.max(0, contentBottom - contentTop)
  const contentCenterY = contentTop + contentHeight / 2
  const relativeCenterY = contentCenterY / canvasHeight

  // Optimal optical center is between 40% and 60%
  const isSafeCenter = relativeCenterY >= 0.4 && relativeCenterY <= 0.6
  let warning: string | undefined

  if (relativeCenterY > 0.62) {
    warning = `[Composition Audit Warning] Content is sinking into the lower third (Center Y: ${(relativeCenterY * 100).toFixed(1)}%). Primary visuals should occupy Y: 40%–60%.`
  } else if (relativeCenterY < 0.35) {
    warning = `[Composition Audit Warning] Content is crowded too high (Center Y: ${(relativeCenterY * 100).toFixed(1)}%). Lower third is empty.`
  }

  return {
    contentTop,
    contentBottom,
    contentHeight,
    contentCenterY,
    relativeCenterY,
    isSafeCenter,
    warning,
  }
}
