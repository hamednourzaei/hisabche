// ============================================
// Reel #68 — «دزد دخلت کیه وقتی نه دزدی شده و نه فروشت کمه؟»
//
// Prompt: Dynamic 18-second Motion Graphics Showreel / Résumé showcase for Hisabche.
// Hook: Never-before-used uncomfortable discovery — «نه کسی از دخل برداشته، نه فروشت کمه؛ پس چرا همیشه بی‌پولی؟»
// Visual Craft: High-velocity kinetic typography, exploded mathematical layers,
// razor-sharp procedural data conduit, luminous emerald resolution.
//
// Permanent Guardrails (Hard Rules 13-19):
// 1. One Focal Stage: centered in Y in [42%, 58%], single visual focus.
// 2. Teleprompter floating subtitle overlay at bottom: 80px.
// 3. Strict text budget: <= 6 words per on-stage label.
// 4. Zero center divider line artifacts (no horizon classes).
// 5. Authentic Persian: natural bazaar merchant terminology.
// 6. AV Sync Law: every sounded word has an action, read via cueAt in actor.
// 7. Evidence-based audio sync: PROVISIONAL_CADENCE_MODEL_ACTIVE.
// ============================================

import type { Reel } from '../engine/types'

const provisional = {
  alignmentStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE' as const,
  isProvisional: true,
  confidence: null,
}

export const reel68: Reel = {
  id: '68',
  title: 'دزد دخلت کیه وقتی نه دزدی شده و نه فروشت کمه؟',
  duration: 18.0,
  theme: 'cinematic-obsidian',
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'کاسب فروش میلیاردی دارد و هیچ سرقتی هم در کار نیست، اما حساب بانکی‌اش همیشه خالی است چون هزینه‌های پنهان و فرمول غلط قیمت سود را می‌بلعند.',
    oldWorkflow:
      'محاسبه چشمی سود، اعتماد به مانده کاغذی فاکتورها، و بی‌خبری از ضایعات و هزینه‌های ریز متفرقه.',
    friction: 'سود روی کاغذ وجود دارد اما هنگام تسویه هفتگی پولی در دخل باقی نمی‌ماند.',
    hisabcheAction:
      'ثبت آنی و خودکار فاکتور، کسر مستقیم بهای تمام‌شده و ضایعات، و محاسبه خط‌به‌خط سود خالص واقعی در کسری از ثانیه.',
    automatedResult:
      'در کسر ثانیه، بهای واقعی کالا، سود حقیقی هر فاکتور و مانده نقدینگی شفاف و همگام می‌شود.',
    businessOutcome:
      'شناسایی آنی نشتی‌های پنهان دخل و رسیدن به سود خالص نقد به‌جای سود موهوم کاغذی.',
    emotionalPayoff:
      'آرامش و تسلط کامل صاحب کسب‌وکار بر تک‌تک ریال‌های دخل با سرعت و زیبایی خیره‌کننده.',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'KineticTillArrest',
      'ExplodedProfitDeconstruct',
      'QuantumSyncConduit',
      'LuminousResolutionBadge',
      'RealtimeProfitTicker',
    ],
  },
  scenes: [
    {
      start: 0.0,
      end: 4.5,
      vo: 'نه کسی از دخل برداشته، نه فروشت کمه؛ پس چرا همیشه بی‌پولی؟',
      spec: {
        kind: 'word-sync',
        actor: 'r68-hook-till-arrest',
        title: 'معمای دخل خالی و فروش بالا',
      },
      sentence: {
        text: 'نه کسی از دخل برداشته، نه فروشت کمه؛ پس چرا همیشه بی‌پولی؟',
        intent: 'قلاب میخکوب‌کننده: تناقض فروش بالا و دخل خالی',
        ...provisional,
        words: [
          { word: 'نه', start: 0.15, end: 0.35 },
          {
            word: 'کسی',
            start: 0.35,
            end: 0.65,
            action: 'till-vault-slam',
            sound: 'cardThock',
          },
          { word: 'از', start: 0.65, end: 0.8 },
          { word: 'دخل', start: 0.8, end: 1.05 },
          { word: 'برداشته،', start: 1.05, end: 1.45 },
          { word: 'نه', start: 1.55, end: 1.75 },
          {
            word: 'فروشت',
            start: 1.75,
            end: 2.15,
            emphasis: true,
            action: 'sales-meter-surge',
            sound: 'cash',
          },
          { word: 'کمه؛', start: 2.15, end: 2.5 },
          { word: 'پس', start: 2.65, end: 2.85 },
          { word: 'چرا', start: 2.85, end: 3.1 },
          {
            word: 'همیشه',
            start: 3.1,
            end: 3.45,
            action: 'drain-leak-pulse',
            sound: 'alert',
          },
          {
            word: 'بی‌پولی؟',
            start: 3.45,
            end: 3.95,
            emphasis: true,
            action: 'question-impact-freeze',
            sound: 'impact',
          },
        ],
        sentenceEnding: { at: 3.8, action: 'till-freeze' },
      },
    },
    {
      start: 4.5,
      end: 9.0,
      vo: 'چون سودت روی کاغذ زنده است، اما هزینه‌های پنهان می‌بلعندش.',
      spec: {
        kind: 'word-sync',
        actor: 'r68-exploded-cogs-leak',
        title: 'کالبدشکافی لایه‌های پنهان هزینه',
      },
      sentence: {
        text: 'چون سودت روی کاغذ زنده است، اما هزینه‌های پنهان می‌بلعندش.',
        intent: 'کالبدشکافی بصری نشتی‌ها و سود کاغذی موهوم',
        ...provisional,
        words: [
          { word: 'چون', start: 0.15, end: 0.35 },
          {
            word: 'سودت',
            start: 0.35,
            end: 0.75,
            emphasis: true,
            action: 'paper-profit-card',
            sound: 'paperRustle',
          },
          { word: 'روی', start: 0.75, end: 0.95 },
          { word: 'کاغذ', start: 0.95, end: 1.3 },
          {
            word: 'زنده',
            start: 1.3,
            end: 1.65,
            action: 'layer-explode-split',
            sound: 'cardEnter',
          },
          { word: 'است،', start: 1.65, end: 1.95 },
          { word: 'اما', start: 2.05, end: 2.25 },
          {
            word: 'هزینه‌های',
            start: 2.25,
            end: 2.75,
            emphasis: true,
            action: 'hidden-costs-slice',
            sound: 'whoosh',
          },
          {
            word: 'پنهان',
            start: 2.75,
            end: 3.15,
            action: 'danger-gap-flash',
            sound: 'alert',
          },
          {
            word: 'می‌بلعندش.',
            start: 3.15,
            end: 3.75,
            emphasis: true,
            action: 'margin-drain-drop',
            sound: 'tick',
          },
        ],
        sentenceEnding: { at: 3.7, action: 'layer-hold' },
      },
    },
    {
      start: 9.0,
      end: 14.5,
      vo: 'در حسابچه، یک فاکتور همزمان انبار، صندوق و سود واقعی را هماهنگ می‌کند.',
      spec: {
        kind: 'word-sync',
        actor: 'r68-quantum-sync-conduit',
        title: 'همزمانی کوانتومی انبار، صندوق و سود',
      },
      sentence: {
        text: 'در حسابچه، یک فاکتور همزمان انبار، صندوق و سود واقعی را هماهنگ می‌کند.',
        intent: 'موتور قدرتمند حسابچه: همگام‌سازی لحظه‌ای چهارگانه',
        ...provisional,
        words: [
          { word: 'در', start: 0.15, end: 0.3 },
          {
            word: 'حسابچه،',
            start: 0.3,
            end: 0.75,
            emphasis: true,
            action: 'conduit-core-ignite',
            sound: 'chime',
          },
          { word: 'یک', start: 0.85, end: 1.05 },
          {
            word: 'فاکتور',
            start: 1.05,
            end: 1.45,
            action: 'invoice-bullet-pulse',
            sound: 'pop',
          },
          {
            word: 'همزمان',
            start: 1.55,
            end: 1.95,
            emphasis: true,
            action: 'quad-node-lock',
            sound: 'cardEnter',
          },
          { word: 'انبار،', start: 1.95, end: 2.3 },
          {
            word: 'صندوق',
            start: 2.3,
            end: 2.7,
            action: 'cash-balance-snap',
            sound: 'tick',
          },
          { word: 'و', start: 2.7, end: 2.85 },
          {
            word: 'سود',
            start: 2.85,
            end: 3.15,
            emphasis: true,
            action: 'real-profit-ticker',
            sound: 'dataFlow',
          },
          { word: 'واقعی', start: 3.15, end: 3.5 },
          { word: 'را', start: 3.5, end: 3.65 },
          {
            word: 'هماهنگ',
            start: 3.65,
            end: 4.15,
            emphasis: true,
            action: 'full-equilibrium-spark',
            sound: 'success',
          },
          { word: 'می‌کند.', start: 4.15, end: 4.4 },
        ],
        sentenceEnding: { at: 4.4, action: 'conduit-hold' },
      },
    },
    {
      start: 14.5,
      end: 18.0,
      vo: 'نبض شفاف دخل تو؛ شروع رایگان در حسابچه.',
      spec: {
        kind: 'word-sync',
        actor: 'r68-luminous-resolution-cta',
        title: 'دعوت به اقدام شوک‌برانگیز',
      },
      sentence: {
        text: 'نبض شفاف دخل تو؛ شروع رایگان در حسابچه.',
        intent: 'فرود باشکوه شو‌ریل و دعوت به اقدام پایانی',
        ...provisional,
        words: [
          {
            word: 'نبض',
            start: 0.15,
            end: 0.45,
            emphasis: true,
            action: 'cta-heartbeat-shock',
            sound: 'insightReveal',
          },
          { word: 'شفاف', start: 0.45, end: 0.8 },
          { word: 'دخل', start: 0.8, end: 1.1 },
          { word: 'تو؛', start: 1.1, end: 1.35 },
          {
            word: 'شروع',
            start: 1.45,
            end: 1.8,
            action: 'cta-button-ignite',
            sound: 'pop',
          },
          {
            word: 'رایگان',
            start: 1.8,
            end: 2.3,
            emphasis: true,
            action: 'cta-emerald-bloom',
            sound: 'ctaResolution',
          },
          { word: 'در', start: 2.3, end: 2.5 },
          {
            word: 'حسابچه.',
            start: 2.5,
            end: 3.0,
            emphasis: true,
            action: 'brand-aurora-glow',
            sound: 'chime',
          },
        ],
        sentenceEnding: { at: 3.0, action: 'cta-final-hold' },
      },
    },
  ],
}
