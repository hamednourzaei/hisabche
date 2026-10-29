// ============================================
// Reel 82 — «گفتگوی مشتری و مالک» (Customer Dialogue — Bespoke SaaS Cut)
//
// Optical Counter Telemetry & Zero-Latency Customer Ledger
// Across-the-counter point-of-sale resolution in under 3 seconds.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  CounterStandOffScene,
  DialogueCtaScene,
  InvoiceDeepDiveScene,
  SingleSourceCoreScene,
  SubSecondQueryScene,
  TrustEquationScene,
} from '../scenes/customer-dialogue'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — Frame-0 Arrest: The Point-of-Sale Stand-Off
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: CounterStandOffScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'alert' },
          { at: 2.5, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'مشتری پای صندوق می‌پرسد چقدر بدهکار است؛ مالک باید دفتر کاغذی را ورق بزند.',
    },

    // 2 — Sub-Second Query: Biometric & NFC Customer Ledger Query
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: SubSecondQueryScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.4, kind: 'scan' },
          { at: 3.2, kind: 'tick' },
          { at: 5.0, kind: 'success' },
        ] as Cue[],
      },
      vo: 'با حسابچه، پاسخ در کمتر از سه ثانیه روی صفحه است: ۴۲ هزار خرید، ۳۱ هزار پرداخت، ۱۱ هزار مانده.',
    },

    // 3 — Historical Deep-Dive: Specific Invoices with Date and Items
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: InvoiceDeepDiveScene,
        cues: [
          { at: 0.2, kind: 'cameraSwish' },
          { at: 1.5, kind: 'pop' },
          { at: 3.0, kind: 'dataFlow' },
          { at: 5.0, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'مشتری سابقه فاکتور قبلی را می‌خواهد؛ تاریخ، ساعت و ریز اقلام بلافاصله نمایش داده می‌شود.',
    },

    // 4 — The Trust Equation: Transparent Ledger vs Awkward Guesswork
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: TrustEquationScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.5, kind: 'alert' },
          { at: 3.5, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'شفافیت در عددها، اعتماد می‌سازد؛ فاکتور برای مشتری پیامک می‌شود و حساب بدون چانه‌زنی تسویه می‌گردد.',
    },

    // 5 — Single Source Core: The Unified Retail Cloud
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: SingleSourceCoreScene,
        cues: [
          { at: 0.2, kind: 'titleHit' },
          { at: 1.5, kind: 'whoosh' },
          { at: 2.8, kind: 'bigReveal' },
        ] as Cue[],
      },
      vo: 'یک دفتر واحد ابری برای فروشنده و خریدار؛ دیگر نگران حساب‌های معوق و نسیه نباشید.',
    },

    // 6 — High-Impact Brand Monolith & CTA
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: DialogueCtaScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.6, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'حسابچه؛ نرم‌افزار ابری حسابداری و فروشگاهی. همین امروز دوره رایگان را شروع کنید.',
    },
  ],
  { noZoom: true },
)

export const reel82: Reel = {
  id: '82',
  title: 'گفتگوی مشتری و مالک — پاسخ حسابچه در لحظه',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  musicMood: 'uplifting',
  noZoom: true,
}
