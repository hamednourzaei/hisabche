// packages/ui/src/components/ui/landing/journey/journey-state.ts
//
// What the 3D scene needs to know from the page and cannot read from the DOM:
// how many stations the story has, the words printed on the invoice, what each
// station's board shows, and which part of the frame is free of text. The stage
// writes it; the scene reads it. A plain object, so no React render stands
// between a scroll and a frame.

import type { IndustrySign } from './journey-industries'
import type { ScreenModel } from './journey-screens'

export interface InvoiceLabels {
  brand: string
  title: string
  sample: string
  number: string
  date: string
  customer: string
  items: string
  quantity: string
  unitPrice: string
  subtotal: string
  discount: string
  tax: string
  total: string
  amount: string
}

export interface JourneyState {
  stations: number
  invoice: InvoiceLabels | null
  /** What a gate's sign says once its machine has recorded the invoice. */
  recorded: string
  /** One board per station, in station order. */
  screens: ScreenModel[]
  /** The kinds of business named on the boards along the walls. */
  industries: IndustrySign[]
  /**
   * The band of the frame, top → bottom as fractions of its height, that no
   * headline, route or caption covers. The camera composes its subject there.
   */
  free: { top: number; bottom: number }
  /** The speech bubble; the scene moves it to the speaker's head. */
  bubble: HTMLElement | null
}

export const journeyState: JourneyState = {
  stations: 5,
  invoice: null,
  recorded: '',
  screens: [],
  industries: [],
  free: { top: 0, bottom: 1 },
  bubble: null,
}
