// ============================================
// Reel 83 — «یک عدد واقعی» (One True Number — Bespoke SaaS Cinematic Cut)
//
// One shop, one day, one indisputable source of financial truth.
// Every figure repeats the verified arithmetic:
//   ۴۲٬۰۰۰ فروش − ۳۱٬۰۰۰ پرداخت = ۱۱٬۰۰۰ ماندهٔ مشتری
//   ۴۲۰٬۰۰۰ فروش − ۲۶۰٬۰۰۰ بهای تمام‌شده − ۷۰٬۰۰۰ هزینه = ۹۰٬۰۰۰ سود
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  TrueCtaScene,
  TrueDialogueScene,
  TrueDilemmaScene,
  TrueManifestoScene,
  TrueQuantumSyncScene,
  TrueWaterfallScene,
} from '../scenes/one-true-number'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — Frame-0 visual arrest: Binary dilemma (Register vs Ledger discrepancy)
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: TrueDilemmaScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'alert' },
          { at: 2.6, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'دخل یک عدد می‌گوید، دفتر یک عدد دیگر. کدام درست است؟',
    },

    // 2 — Instant Counter Query: Customer statement resolved in 0.2s
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: TrueDialogueScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.4, kind: 'scan' },
          { at: 3.4, kind: 'tick' },
          { at: 5.0, kind: 'success' },
        ] as Cue[],
      },
      vo: 'مشتری پای صندوق مانده‌اش را می‌پرسد؛ حسابچه در لحظه می‌گوید: ۴۲ هزار خرید، ۳۱ هزار پرداخت، ۱۱ هزار مانده.',
    },

    // 3 — 1 Invoice, 5 Simultaneous Quantum Syncs
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: TrueQuantumSyncScene,
        cues: [
          { at: 0.2, kind: 'cinematicReveal' },
          { at: 1.2, kind: 'pop' },
          { at: 2.2, kind: 'dataFlow' },
          { at: 3.8, kind: 'sync' },
          { at: 5.2, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'با یک کلیک فاکتور، هم‌زمان انبار کسر می‌شود، سند دوبل می‌خورد و صندوق شارژ می‌شود.',
    },

    // 4 — Real Profit Waterfall: Complete arithmetic certainty
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: TrueWaterfallScene,
        cues: [
          { at: 0.2, kind: 'pop' },
          { at: 1.2, kind: 'tick' },
          { at: 2.2, kind: 'tick' },
          { at: 3.4, kind: 'cash' },
          { at: 5.2, kind: 'financialMilestone' },
        ] as Cue[],
      },
      vo: 'فروش ۴۲۰ هزار، خرید ۲۶۰ هزار، هزینه ۷۰ هزار؛ سود واقعی ۹۰ هزار است؛ نه حدس، نه تخمین.',
    },

    // 5 — The Indisputable Manifesto: Single source of truth
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: TrueManifestoScene,
        cues: [
          { at: 0.2, kind: 'titleHit' },
          { at: 1.2, kind: 'whoosh' },
          { at: 2.2, kind: 'bigReveal' },
          { at: 4.0, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'نه حدس، نه دفتر دوم؛ فقط یک عدد واقعی و قابل استناد.',
    },

    // 6 — Architectural Brand Monolith & Conversion CTA
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: TrueCtaScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.4, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'حسابچه؛ نرم‌افزار مالی یکپارچه مغازه و کارگاه. همین امروز رایگان شروع کنید.',
    },
  ],
  { noZoom: true },
)

export const reel83: Reel = {
  id: '83',
  title: 'یک عدد واقعی — چرخه کامل فروش، انبار، دفتر و سود',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  musicMood: 'uplifting',
  noZoom: true,
}
