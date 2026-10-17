// ============================================
// Reel #66 — «یک شخصیت از حسابچه می‌گوید: کاسب خواربار و لوازم خانگی»
//
// Prompt: 40-second Veo/Gemini grocery merchant narrative.
// Persona: friendly retail-shopkeeper in mid-30s behind a wooden counter.
// Core Story:
//   Shot 1: Hook — Pile of paper receipts swirls into glowing emerald glass card above phone.
//   Shot 2: Single invoice automatically splits into stock, till, customer, and ledger.
//   Shot 3: Customer receivables timeline — items taken, paid, running balance.
//   Shot 4: Offline resilience — Wi-Fi cuts, sales continue, auto cloud sync on reconnect.
//   Shot 5: Final CTA — Cards settle into clean shopkeeper dashboard, free start at hisabche.com.
//
// Hard Rules & Guardrails (Rules 13-17):
// 1. Single Focal Stage (Y in [42%, 58%]) — flex centered, zero vertical collision.
// 2. Teleprompter floating caption overlay at bottom: 80px.
// 3. Strict text budget: <= 6 words per label on-stage.
// 4. Zero horizontal divider lines or border artifacts.
// 5. Authentic Persian: natural bazaar / shopkeeping terminology.
// 6. AV Sync Law: every sounded word has an action, every action read via cueAt in actor.
// 7. Evidence-based audio sync: PROVISIONAL_CADENCE_MODEL_ACTIVE pending human voiceover.
// ============================================

import type { Reel } from '../engine/types'

const provisional = {
  alignmentStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE' as const,
  isProvisional: true,
  confidence: null,
}

export const reel66: Reel = {
  id: '66',
  title: 'یک شخصیت از حسابچه می‌گوید: فروش روزانه، نسیه و کار بدون اینترنت',
  duration: 40.0,
  theme: 'cyber-emerald',
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'فروش روزانه بالا است اما انتهای روز کاسب سود واقعی را نمی‌داند، نسیه‌ها در دفتر نامشخص است و قطعی اینترنت فروش را فلج می‌کند.',
    oldWorkflow:
      'دفتر کاغذی قطور، فاکتورهای دست‌نویس پراکنده، شمارش دستی دخل شبانه و توقف کار هنگام قطعی شبکه.',
    friction:
      'یک فاکتور باید در چندین دفتر و فایل ثبت شود؛ نسیه مشتریان فراموش می‌شود و با قطع اینترنت صف مشتری شاکی تشکیل می‌شود.',
    hisabcheAction:
      'صدور یک فاکتور به شکل همزمان انبار، صندوق، مانده مشتری و سند دفتر کل را به‌روز می‌کند؛ کار کاملاً آفلاین کار می‌کند و خودکار همگام می‌شود.',
    automatedResult:
      'شفافیت لحظه‌ای سود خالص، صورت‌حساب دقیق نسیه هر مشتری با یک نگاه، و تداوم فروش پای صندوق بدون وابستگی به اینترنت.',
    businessOutcome:
      'آرامش خاطر کاسب، جلوگیری از کسری دخل و طلب‌های سوخت‌شده، و مدیریت خودکار کل مغازه.',
    emotionalPayoff:
      'لبخند و اطمینان خاطر صاحب فروشگاه پشت پیشخوان، همراه با کنترل کامل بر ارقام و سود.',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'PaperPileSwirlTransform',
      'InvoiceQuadSplitMatrix',
      'CustomerReceivableTimeline',
      'OfflineQueueCloudSync',
      'UnifiedShopkeeperDashboard',
    ],
  },
  scenes: [
    {
      start: 0.0,
      end: 8.0,
      vo: 'فروشت زیاده، ولی آخر روز نمیدونی سودت چقدر شد؟ با حسابچه بدون.',
      spec: {
        kind: 'word-sync',
        actor: 'r66-hook-paper-to-card',
        title: 'کوه فاکتور کاغذی به کارت هوشمند',
      },
      sentence: {
        text: 'فروشت زیاده، ولی آخر روز نمیدونی سودت چقدر شد؟ با حسابچه بدون.',
        intent: 'هوک سردرگمی سود پای پیشخوان و تولد کارت هوشمند',
        ...provisional,
        words: [
          {
            word: 'فروشت',
            start: 0.2,
            end: 0.65,
            emphasis: true,
            action: 'pile-paper-reveal',
            sound: 'cardThock',
          },
          { word: 'زیاده،', start: 0.65, end: 1.1 },
          { word: 'ولی', start: 1.25, end: 1.5 },
          { word: 'آخر', start: 1.5, end: 1.8 },
          {
            word: 'روز',
            start: 1.8,
            end: 2.1,
            action: 'calc-overwhelm',
            sound: 'paperRustle',
          },
          { word: 'نمیدونی', start: 2.2, end: 2.7, emphasis: true },
          {
            word: 'سودت',
            start: 2.7,
            end: 3.1,
            emphasis: true,
            action: 'profit-question',
            sound: 'alert',
          },
          { word: 'چقدر', start: 3.1, end: 3.5 },
          { word: 'شد؟', start: 3.5, end: 3.9 },
          { word: 'با', start: 4.4, end: 4.7 },
          {
            word: 'حسابچه',
            start: 4.7,
            end: 5.3,
            emphasis: true,
            action: 'card-reform-swirl',
            sound: 'chime',
          },
          {
            word: 'بدون.',
            start: 5.3,
            end: 5.85,
            emphasis: true,
            action: 'card-phone-float',
            sound: 'pop',
          },
        ],
        sentenceEnding: { at: 6.8, action: 'hook-hold' },
      },
    },
    {
      start: 8.0,
      end: 16.0,
      vo: 'یه فاکتور میزنی؛ موجودی انبار، صندوق، حساب مشتری و دفتر خودش به‌روز میشه.',
      spec: {
        kind: 'word-sync',
        actor: 'r66-invoice-quad-split',
        title: 'انشعاب خودکار فاکتور به چهار ارکان',
      },
      sentence: {
        text: 'یه فاکتور میزنی؛ موجودی انبار، صندوق، حساب مشتری و دفتر خودش به‌روز میشه.',
        intent: 'موتور ثبت همزمان: انبار، صندوق، مشتری و سند حسابداری',
        ...provisional,
        words: [
          { word: 'یه', start: 0.2, end: 0.45 },
          {
            word: 'فاکتور',
            start: 0.45,
            end: 0.95,
            emphasis: true,
            action: 'invoice-tap-fly',
            sound: 'cash',
          },
          { word: 'میزنی؛', start: 0.95, end: 1.45 },
          { word: 'موجودی', start: 1.7, end: 2.15 },
          {
            word: 'انبار،',
            start: 2.15,
            end: 2.65,
            emphasis: true,
            action: 'shelf-stock-split',
            sound: 'cardEnter',
          },
          {
            word: 'صندوق،',
            start: 2.8,
            end: 3.35,
            emphasis: true,
            action: 'cash-drawer-split',
            sound: 'tick',
          },
          { word: 'حساب', start: 3.5, end: 3.85 },
          {
            word: 'مشتری',
            start: 3.85,
            end: 4.35,
            emphasis: true,
            action: 'customer-card-split',
            sound: 'cardEnter',
          },
          { word: 'و', start: 4.45, end: 4.65 },
          {
            word: 'دفتر',
            start: 4.65,
            end: 5.1,
            emphasis: true,
            action: 'ledger-book-split',
            sound: 'paperRustle',
          },
          { word: 'خودش', start: 5.25, end: 5.65 },
          {
            word: 'به‌روز',
            start: 5.65,
            end: 6.1,
            emphasis: true,
            action: 'quad-sync-spark',
            sound: 'success',
          },
          { word: 'میشه.', start: 6.1, end: 6.65 },
        ],
        sentenceEnding: { at: 7.2, action: 'quad-hold' },
      },
    },
    {
      start: 16.0,
      end: 24.0,
      vo: 'نسیه‌ی هر مشتری با یه نگاه: چی برده، چی داده، چقدر مونده.',
      spec: {
        kind: 'word-sync',
        actor: 'r66-receivables-timeline',
        title: 'گردش حساب و شفافیت نسیه مشتری',
      },
      sentence: {
        text: 'نسیه‌ی هر مشتری با یه نگاه: چی برده، چی داده، چقدر مونده.',
        intent: 'تایم‌لاین گردش حساب نسیه و مانده تسویه',
        ...provisional,
        words: [
          {
            word: 'نسیه‌ی',
            start: 0.2,
            end: 0.65,
            emphasis: true,
            action: 'customer-card-open',
            sound: 'cardThock',
          },
          { word: 'هر', start: 0.65, end: 0.9 },
          { word: 'مشتری', start: 0.9, end: 1.35 },
          { word: 'با', start: 1.5, end: 1.7 },
          { word: 'یه', start: 1.7, end: 1.95 },
          {
            word: 'نگاه:',
            start: 1.95,
            end: 2.45,
            emphasis: true,
            action: 'timeline-reveal',
            sound: 'whoosh',
          },
          { word: 'چی', start: 2.65, end: 2.95 },
          {
            word: 'برده،',
            start: 2.95,
            end: 3.45,
            emphasis: true,
            action: 'invoice-chip-add',
            sound: 'cardEnter',
          },
          { word: 'چی', start: 3.65, end: 3.95 },
          {
            word: 'داده،',
            start: 3.95,
            end: 4.45,
            emphasis: true,
            action: 'payment-chip-drop',
            sound: 'cash',
          },
          { word: 'چقدر', start: 4.7, end: 5.15 },
          {
            word: 'مونده.',
            start: 5.15,
            end: 5.75,
            emphasis: true,
            action: 'balance-bar-drain',
            sound: 'sync',
          },
        ],
        sentenceEnding: { at: 6.8, action: 'timeline-hold' },
      },
    },
    {
      start: 24.0,
      end: 32.0,
      vo: 'اینترنت قطع شد؟ فروش وانمیسته؛ وصل که شد، خودش هماهنگ میکنه.',
      spec: {
        kind: 'word-sync',
        actor: 'r66-offline-cloud-sync',
        title: 'فروش آفلاین و هماهنگی ابری',
      },
      sentence: {
        text: 'اینترنت قطع شد؟ فروش وانمیسته؛ وصل که شد، خودش هماهنگ میکنه.',
        intent: 'پایداری فروش هنگام قطعی اینترنت و سینک ابری بی‌وقفه',
        ...provisional,
        words: [
          {
            word: 'اینترنت',
            start: 0.2,
            end: 0.7,
            emphasis: true,
            action: 'wifi-break-flicker',
            sound: 'alert',
          },
          { word: 'قطع', start: 0.7, end: 1.1 },
          { word: 'شد؟', start: 1.1, end: 1.45 },
          {
            word: 'فروش',
            start: 1.75,
            end: 2.15,
            emphasis: true,
            action: 'offline-sale-keep',
            sound: 'cardEnter',
          },
          {
            word: 'وانمیسته؛',
            start: 2.15,
            end: 2.75,
            emphasis: true,
            action: 'queue-stack-up',
            sound: 'tick',
          },
          {
            word: 'وصل',
            start: 3.3,
            end: 3.75,
            emphasis: true,
            action: 'wifi-reconnect-green',
            sound: 'chime',
          },
          { word: 'که', start: 3.75, end: 3.95 },
          { word: 'شد،', start: 3.95, end: 4.25 },
          { word: 'خودش', start: 4.45, end: 4.85 },
          {
            word: 'هماهنگ',
            start: 4.85,
            end: 5.35,
            emphasis: true,
            action: 'cloud-stream-wave',
            sound: 'dataFlow',
          },
          {
            word: 'میکنه.',
            start: 5.35,
            end: 5.85,
            emphasis: true,
            action: 'cloud-sync-complete',
            sound: 'success',
          },
        ],
        sentenceEnding: { at: 6.9, action: 'cloud-hold' },
      },
    },
    {
      start: 32.0,
      end: 40.0,
      vo: 'حساب مغازه‌ات رو دست حسابچه بده؛ شروع رایگانه.',
      spec: {
        kind: 'word-sync',
        actor: 'r66-unified-dashboard-cta',
        title: 'داشبورد جامع و شروع رایگان',
      },
      sentence: {
        text: 'حساب مغازه‌ات رو دست حسابچه بده؛ شروع رایگان در حسابچه.',
        intent: 'جمع‌بندی در داشبورد آرام و دعوت به اقدام',
        ...provisional,
        words: [
          {
            word: 'حساب',
            start: 0.25,
            end: 0.65,
            emphasis: true,
            action: 'cards-converge-dash',
            sound: 'whoosh',
          },
          { word: 'مغازه‌ات', start: 0.65, end: 1.15 },
          { word: 'رو', start: 1.15, end: 1.35 },
          { word: 'دست', start: 1.35, end: 1.65 },
          {
            word: 'حسابچه',
            start: 1.65,
            end: 2.15,
            emphasis: true,
            action: 'dashboard-reveal',
            sound: 'insightReveal',
          },
          { word: 'بده؛', start: 2.15, end: 2.65 },
          {
            word: 'شروع',
            start: 3.0,
            end: 3.45,
            emphasis: true,
            action: 'cta-button-enter',
            sound: 'pop',
          },
          {
            word: 'رایگانه.',
            start: 3.45,
            end: 4.1,
            emphasis: true,
            action: 'cta-spark-shine',
            sound: 'ctaResolution',
          },
        ],
        sentenceEnding: { at: 6.5, action: 'cta-final-hold' },
      },
    },
  ],
}
