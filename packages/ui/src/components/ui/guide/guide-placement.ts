// ============================================
// packages/ui/src/components/ui/guide/guide-placement.ts
//
// Where the guide card stands and where its arrow points — pure, so both
// directions are tested without a browser.
//
// ⚠️ THE ARROW POINTS AT THE SECTION IN RIGHT-TO-LEFT TOO (8 Nov 2026).
// The card used to be aligned to the section's physical LEFT edge and the
// arrow drawn 20px from it. In Persian and Dari a wide section starts on the
// RIGHT, so the card sat at the far end of the row and the arrow pointed at
// nothing the reader was looking at. The card now aligns with the section's
// START edge for the reading direction, and a narrow section gets the card
// centred on it with the arrow at its middle.
// ============================================

export interface GuideRect {
  top: number
  bottom: number
  left: number
  right: number
}

export interface GuidePlacement {
  top: number
  left: number
  width: number
  /** Which side of the card touches the section; null when it could not. */
  arrow: 'top' | 'bottom' | null
  /** Physical pixels from the card's left edge to the arrow. */
  arrowOffset: number
}

/** Wide enough for a sentence, narrow enough to stay a card. */
export const GUIDE_CARD_MAX_WIDTH = 340
/** Never closer than this to the edge of the viewport. */
export const GUIDE_EDGE = 12
/** Space between the card and the section it describes. */
export const GUIDE_GAP = 12
/** Space left around the section inside the spotlight. */
export const GUIDE_SPOTLIGHT_PADDING = 6

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function placeGuideCard(input: {
  target: GuideRect | null
  viewport: { width: number; height: number }
  cardHeight: number
  direction: 'ltr' | 'rtl'
}): GuidePlacement {
  const { target, viewport, cardHeight, direction } = input
  const width = Math.min(GUIDE_CARD_MAX_WIDTH, viewport.width - GUIDE_EDGE * 2)
  const maxLeft = Math.max(GUIDE_EDGE, viewport.width - width - GUIDE_EDGE)
  const maxTop = Math.max(GUIDE_EDGE, viewport.height - cardHeight - GUIDE_EDGE)

  // Nothing to stand beside: the middle of the screen.
  if (!target) {
    return {
      top: clamp((viewport.height - cardHeight) / 2, GUIDE_EDGE, maxTop),
      left: clamp((viewport.width - width) / 2, GUIDE_EDGE, maxLeft),
      width,
      arrow: null,
      arrowOffset: 0,
    }
  }

  const targetWidth = target.right - target.left
  const narrow = targetWidth <= width
  // The point the arrow aims at: a narrow section's middle, a wide one's start.
  const focusX = narrow
    ? target.left + targetWidth / 2
    : direction === 'rtl'
      ? target.right - 28
      : target.left + 28
  const rawLeft = narrow
    ? focusX - width / 2
    : direction === 'rtl'
      ? target.right - width
      : target.left
  const left = clamp(rawLeft, GUIDE_EDGE, maxLeft)

  const fitsAbove = target.top - GUIDE_EDGE >= cardHeight + GUIDE_GAP
  const fitsBelow = viewport.height - target.bottom - GUIDE_EDGE >= cardHeight + GUIDE_GAP

  let top: number
  let arrow: GuidePlacement['arrow']
  if (fitsAbove) {
    top = target.top - cardHeight - GUIDE_GAP
    arrow = 'bottom'
  } else if (fitsBelow) {
    top = target.bottom + GUIDE_GAP
    arrow = 'top'
  } else {
    // The section fills the screen: the card sits inside its lower part.
    top = maxTop
    arrow = null
  }

  return {
    top: clamp(top, GUIDE_EDGE, maxTop),
    left,
    width,
    arrow,
    arrowOffset: clamp(focusX - left - 6, 14, width - 26),
  }
}

/** The hole in the blur: the section plus a little room, kept on screen. */
export function spotlightHole(
  target: GuideRect,
  viewport: { width: number; height: number },
): GuideRect {
  return {
    top: clamp(target.top - GUIDE_SPOTLIGHT_PADDING, 0, viewport.height),
    bottom: clamp(target.bottom + GUIDE_SPOTLIGHT_PADDING, 0, viewport.height),
    left: clamp(target.left - GUIDE_SPOTLIGHT_PADDING, 0, viewport.width),
    right: clamp(target.right + GUIDE_SPOTLIGHT_PADDING, 0, viewport.width),
  }
}
