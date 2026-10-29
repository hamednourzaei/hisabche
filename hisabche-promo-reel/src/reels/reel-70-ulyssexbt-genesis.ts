// ============================================
// Reel #70 — «ulyssexbt: Genesis Block»
//
// 15-second brand identity motion showcase for ulyssexbt.
// Hammer-hook at frame 0: chaos of geometric primitives freezes into the wordmark.
// Pure numbers, geometry, blockchain primitives — no currency units.
// Theme: kinetic-manifesto (bold typographic velocity) / full-bleed-kinetic layout.
// AV Sync Law: every sounded word has action read via cueAt.
// ============================================

import type { Reel } from '../engine/types'
import type { WordCue } from '../engine/speech-model'

const provisional = {
  alignmentStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE' as const,
  isProvisional: true,
  confidence: null,
}

function w(word: string, start: number, end: number, extra: Partial<WordCue> = {}): WordCue {
  return { word, start, end, ...extra }
}

export const reel70: Reel = {
  id: '70',
  title: 'ulyssexbt: Genesis Block',
  duration: 15.0,
  theme: 'kinetic-manifesto',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain: 'هویت برند در شلوغی کریپتو گم می‌شود؛ نیاز به یک امضای بصری غیرقابل‌فراموشی است.',
    oldWorkflow: 'لوگوهای استاتیک، تایپوگرافی معمولی، هیچ موشنی که داستان بلاک‌چین را بگوید.',
    friction: 'بدون یک سیستم بصریِ پویا، برند در فید X زیر ۳ ثانیه نادیده گرفته می‌شود.',
    hisabcheAction:
      'سیستم موشنِ ulyssexbt: ژنسیس‑بلاکِ تایپوگرافی، بلاک‌های عددی، شبکه نودها، و قفل نهایی — همه در ۱۵ ثانیه.',
    automatedResult: 'امضای بصری که در ۰.۳ ثانیه شناخته می‌شود و تا ۱۵ ثانیه ماندگار می‌ماند.',
    businessOutcome: 'تشخیص برند در میان ۱۰۰۰۰ مخاطب X با یک امضای متحرک واحد.',
    emotionalPayoff: 'احساس اعتماد، دقتِ کد، و قدرتِ شبکه.',
    cta: 'ulyssexbt.com',
    selectedOperators: [
      'GenesisFreeze',
      'BlockStackOdometer',
      'NetworkPulseConstellation',
      'FinalLockCta',
    ],
  },
  scenes: [
    {
      start: 0.0,
      end: 3.5,
      noZoom: true,
      vo: 'ulyssexbt — ژنسیس.',
      spec: { kind: 'word-sync', actor: 'r70-genesis-freeze', title: 'ژنسیس فریز' },
      sentence: {
        text: 'ulyssexbt — ژنسیس.',
        intent: 'قلاب میخکوب: آشفتگی هندسی فریز می‌شود و وردمارک قفل می‌شود',
        ...provisional,
        words: [
          w('ulyssexbt', 0.15, 1.1, { emphasis: true, action: 'genesis-freeze', sound: 'impact' }),
          w('ژنسیس', 1.3, 2.1, { emphasis: true, action: 'wordmark-lock', sound: 'bigReveal' }),
        ],
        sentenceEnding: { at: 2.3, action: 'freeze-hold' },
      },
    },
    {
      start: 3.5,
      end: 7.5,
      noZoom: true,
      vo: 'بلاک ۸۴۷۲۹۱ — هش ۰۰۰۰... — تایم‌استمپ ۱۷۰۸۲۰۲۶.',
      spec: { kind: 'word-sync', actor: 'r70-block-stack', title: 'بلاک‌چینِ عددی' },
      sentence: {
        text: 'بلاک ۸۴۷۲۹۱ — هش ۰۰۰۰... — تایم‌استمپ ۱۷۰۸۲۰۲۶.',
        intent: 'سازوکار: پشته بلاک‌ها با هش و ارتفاع',
        ...provisional,
        words: [
          w('بلاک', 0.15, 0.6, { emphasis: true, action: 'block-label', sound: 'cardEnter' }),
          w('۸۴۷۲۹۱', 0.7, 1.3, {
            emphasis: true,
            action: 'height-odometer',
            sound: 'clockTickRapid',
          }),
          w('هش', 1.5, 1.85, { emphasis: true, action: 'hash-reveal', sound: 'scan' }),
          w('۰۰۰۰', 1.9, 2.35, { emphasis: true, action: 'leading-zeros', sound: 'tick' }),
          w('تایم‌استمپ', 2.5, 3.1, {
            emphasis: true,
            action: 'timestamp-type',
            sound: 'typewriterClick',
          }),
          w('۱۷۰۸۲۰۲۶', 3.15, 3.7, { emphasis: true, action: 'date-stamp', sound: 'pop' }),
        ],
        sentenceEnding: { at: 3.9, action: 'stack-hold' },
      },
    },
    {
      start: 7.5,
      end: 11.5,
      noZoom: true,
      vo: '۱۲۸ نود — ۰ تاخیر — همگامی فوری.',
      spec: { kind: 'word-sync', actor: 'r70-network-pulse', title: 'شبکه نودها' },
      sentence: {
        text: '۱۲۸ نود — ۰ تاخیر — همگامی فوری.',
        intent: 'اثبات: شبکه زنده، صفر تاخیر، همگامی',
        ...provisional,
        words: [
          w('۱۲۸', 0.1, 0.6, { emphasis: true, action: 'node-count', sound: 'dataFlow' }),
          w('نود', 0.65, 1.0, { emphasis: true, action: 'nodes-ignite', sound: 'sync' }),
          w('۰', 1.2, 1.55, { emphasis: true, action: 'zero-latency', sound: 'chime' }),
          w('تاخیر', 1.6, 2.05),
          w('همگامی', 2.2, 2.8, { emphasis: true, action: 'sync-wave', sound: 'success' }),
          w('فوری', 2.85, 3.3, { emphasis: true, action: 'instant-lock', sound: 'ctaResolution' }),
        ],
        sentenceEnding: { at: 2.5, action: 'pulse-hold' },
      },
    },
    {
      start: 11.5,
      end: 15.0,
      noZoom: true,
      vo: 'ulyssexbt — کدِ اعتماد. ulyssexbt.com',
      spec: { kind: 'word-sync', actor: 'r70-final-lock', title: 'قفل نهایی' },
      sentence: {
        text: 'ulyssexbt — کدِ اعتماد. ulyssexbt.com',
        intent: 'دعوت به اقدام: برند، اعتماد، آدرس',
        ...provisional,
        words: [
          w('ulyssexbt', 0.1, 0.9, { emphasis: true, action: 'brand-final', sound: 'majorReveal' }),
          w('کدِ', 1.0, 1.25),
          w('اعتماد', 1.3, 1.85, {
            emphasis: true,
            action: 'trust-seal',
            sound: 'successResolution',
          }),
          w('ulyssexbt.com', 2.1, 3.0, {
            emphasis: true,
            action: 'url-type',
            sound: 'typewriterClick',
          }),
        ],
        sentenceEnding: { at: 3.2, action: 'cta-final-hold' },
      },
    },
  ],
}
