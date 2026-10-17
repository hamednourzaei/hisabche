// ============================================
// Hisabche Motion Design Studio — 40-Reel Diversity Registry & Rotation Engine
//
// Strictly enforces the Anti-Template-Trap governance:
// 1. 5 Distinct Art-Direction Systems (Continuous cyclic rotation)
//    - cinematic-obsidian (Spatial Dark Product Film)
//    - swiss-editorial (High-Craft Daylight Information Design: #F7F6F2 alabaster, architectural ink, zero neon)
//    - kinetic-manifesto (Full-Bleed Typographic Velocity: 80% canvas display type, hard cuts)
//    - procedural-spatial (Generative Network & Flow Topology: live bezier nodes, coordinate planes)
//    - financial-intelligence (Executive Ledger & Data Storytelling: double-entry mechanics, waterfall charts)
//
// 2. 5 Radical Layout Topologies (Continuous cyclic rotation)
//    - split-screen-horizon (Topology A: Horizontal split separating pain from automated result)
//    - asymmetrical-swiss-grid (Topology B: Dynamic off-center editorial framing with negative space)
//    - full-bleed-kinetic (Topology C: Zero cards; text & SVG masks dominate 9:16 vertical screen)
//    - spatial-2.5d-portal (Topology D: Camera zooms through layered UI planes, deep Z-axis)
//    - data-flow-matrix (Topology E: Centralized interactive chart or radial hub with live metric tickers)
//
// 3. Dynamic Template Guardrails
//    - Runtime & Build-time assertion: If any reel's layout matches any of the last 3 rendered reels,
//      throws an explicit error forcing a topology switch.
//    - Guarantees pairwise distinction for key test cases: Reel #10 != Reel #22 != Reel #40.
// ============================================

import type { OpeningArchetype, ThemeName } from '../engine/types'
import type { ViralTemplateId } from '../templates/types'
import { getReelViralTemplate } from './template-catalog'

export type ArtDirection =
  | 'cinematic-obsidian'
  | 'swiss-editorial'
  | 'kinetic-manifesto'
  | 'procedural-spatial'
  | 'financial-intelligence'

export type LayoutTopology =
  | 'single-focal-stage'
  | 'split-screen-horizon'
  | 'asymmetrical-swiss-grid'
  | 'full-bleed-kinetic'
  | 'spatial-2.5d-portal'
  | 'data-flow-matrix'

export type MerchantPainCategory =
  | 'untracked-receivables'
  | 'inventory-discrepancy'
  | 'profit-illusion'
  | 'offline-pos-paralysis'
  | 'tax-audit-penalties'
  | 'multi-branch-blindness'
  | 'cheque-domino-collapse'

export type AudioStrategy =
  'rhythmic-urgency' | 'restrained-dread' | 'tactile-foley' | 'high-contrast-impact'

export interface ReelRegistryEntry {
  id: string
  title: string
  artDirection: ArtDirection
  layoutTopology: LayoutTopology
  operators: string[]
  themeName: ThemeName
  cardQuotaMax: number
  targetCustomer:
    'retail-shopkeeper' | 'wholesaler' | 'workshop-producer' | 'services' | 'accountant'
  openingArchetype?: OpeningArchetype
  merchantPainCategory?: MerchantPainCategory
  audioStrategy?: AudioStrategy
  viralTemplate?: ViralTemplateId
  hookConcept?: string
  narrativeArc?: string
  ctaVariant?: string
  description?: string
}

export const ART_DIRECTIONS: ArtDirection[] = [
  'cinematic-obsidian',
  'swiss-editorial',
  'kinetic-manifesto',
  'procedural-spatial',
  'financial-intelligence',
]

export const LAYOUT_TOPOLOGIES: LayoutTopology[] = [
  'single-focal-stage',
  'asymmetrical-swiss-grid',
  'full-bleed-kinetic',
  'spatial-2.5d-portal',
  'data-flow-matrix',
]

// ─── 40-Reel Explicit Diversity Registry ──────────────────────────────────────

export const REEL_REGISTRY_LIST: ReelRegistryEntry[] = [
  {
    id: '01',
    title: 'در کسب‌وکار تو، حساب‌وکتابت چند جا پخش شده؟',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'split-screen-horizon',
    operators: [
      'Split-Screen Blade Shutter',
      'Camera Portal Pass-Through',
      'Dynamic Spotlight Cone',
      'Glassmorphic Edge Refraction',
      'Odometer Slot Machine Roll',
    ],
    themeName: 'obsidian-cinematic',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'تفکیک استرس اطلاعات پراکنده در بالا از آرامش یکپارچگی حسابچه در پایین',
  },
  {
    id: '02',
    title: 'ثبت فاکتور سریع زیر ۵ ثانیه',
    artDirection: 'swiss-editorial',
    layoutTopology: 'asymmetrical-swiss-grid',
    operators: [
      'Odometer Slot Machine Roll',
      'Baseline Curtain Rise',
      'Animated Highlighter Sweep',
      'Oversized Counter Display',
      'Scramble Decode Cipher',
    ],
    themeName: 'swiss-editorial',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'تایپوگرافی دقیق روزمینی سوییسی، گرید معماری، فاکتورهای سرعتی بدون نئون',
  },
  {
    id: '03',
    title: 'کار بدون اینترنت و قطعی پای صندوق',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'full-bleed-kinetic',
    operators: [
      'Kinetic Elastic Snap',
      'Text Stagger Velocity Cascade',
      'Typographic Mask Video Fill',
      'Iris Reveal Mask',
      'Kinetic Grid Shifter',
    ],
    themeName: 'kinetic-manifesto',
    cardQuotaMax: 0,
    targetCustomer: 'retail-shopkeeper',
    description: 'تایپوگرافی بولد تمام‌صفحه ۸۰ درصدی؛ قطع کامل اینترنت و پایداری صندوق',
  },
  {
    id: '04',
    title: 'کاردکس و انبارداری لحظه‌ای',
    artDirection: 'procedural-spatial',
    layoutTopology: 'spatial-2.5d-portal',
    operators: [
      'Circuit Path Tracer',
      'Isometric UI Layer Explosion',
      'Magnetic Particle Stream',
      'Dual Camera Horizon',
      'Wireframe to Render Solidification',
    ],
    themeName: 'procedural-spatial',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    description: 'شبکه هندسی نودهای انبارداری، کاردکس لحظه‌ای و مسیر حرکت اجناس',
  },
  {
    id: '05',
    title: 'محاسبه سود خالص بر اساس بهای تمام شده',
    artDirection: 'financial-intelligence',
    layoutTopology: 'data-flow-matrix',
    operators: [
      'Profit Waterfall Drain',
      'X-Ray Profit Scanner',
      'Double-Entry Balance Scale',
      'Heatmap Inventory Grid',
      'Odometer Slot Machine Roll',
    ],
    themeName: 'financial-intelligence',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    description: 'آبشار مالی شفاف درآمد، بهای لایه‌ای کالا (FIFO) و سود خالص قطعی',
  },
  {
    id: '06',
    title: 'مدیریت مشتریان و صورتحساب نسیه',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'split-screen-horizon',
    operators: [
      'Split-Screen Blade Shutter',
      'Dual Camera Horizon',
      'Odometer Slot Machine Roll',
      'Volumetric Light Ray Sweep',
      'Glassmorphic Edge Refraction',
    ],
    themeName: 'obsidian-cinematic',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'مقایسه افقی دفترچه نسیه خط‌خورده در بالا و تراز پیامکی حسابچه در پایین',
  },
  {
    id: '07',
    title: 'سند حسابداری اتوماتیک و دفتر کل',
    artDirection: 'swiss-editorial',
    layoutTopology: 'asymmetrical-swiss-grid',
    operators: [
      'Baseline Curtain Rise',
      'Double-Entry Balance Scale',
      'Animated Highlighter Sweep',
      'Oversized Counter Display',
      'Scramble Decode Cipher',
    ],
    themeName: 'swiss-editorial',
    cardQuotaMax: 1,
    targetCustomer: 'accountant',
    description: 'جدول دوبل حسابداری با فونت کنتراست‌بالا روی پس‌زمینه گرم آلاباستر #F7F6F2',
  },
  {
    id: '08',
    title: 'راس‌گیری و یادآوری چک‌های مدت‌دار',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'full-bleed-kinetic',
    operators: [
      'Split Word Collision',
      'Kinetic Elastic Snap',
      'Text Stagger Velocity Cascade',
      'Oversized Counter Display',
      'Iris Reveal Mask',
    ],
    themeName: 'kinetic-manifesto',
    cardQuotaMax: 0,
    targetCustomer: 'wholesaler',
    description: 'تایپوگرافی تکانشی و هشدار سررسید اقساط و چک‌های بازار بدون کارت',
  },
  {
    id: '09',
    title: 'چند انباره و انتقال کالا بین شعب',
    artDirection: 'procedural-spatial',
    layoutTopology: 'spatial-2.5d-portal',
    operators: [
      'Circuit Path Tracer',
      'Magnetic Particle Stream',
      'Isometric UI Layer Explosion',
      'Dual Camera Horizon',
      'SVG Shape Morphing',
    ],
    themeName: 'procedural-spatial',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    description: 'دوربین سه‌بعدی متحرک در فضا میان انبارهای پخش و شعب توزیع',
  },
  {
    id: '10',
    title: 'گزارشات مدیریتی و ترازنامه مالی',
    artDirection: 'financial-intelligence',
    layoutTopology: 'data-flow-matrix',
    operators: [
      'Radial Clock Dial & Progress Ring',
      'Double-Entry Balance Scale',
      'Heatmap Inventory Grid',
      'Odometer Slot Machine Roll',
      'Dynamic Spotlight Cone',
    ],
    themeName: 'financial-intelligence',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'داشبورد مدیریتی جامع با جریان داده زنده، ترازنامه و ساعت عقربه‌ای شیفت',
  },
  {
    id: '11',
    title: 'فاکتور خرید یا کاغذپاره؟',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'split-screen-horizon',
    operators: [
      'Split-Screen Blade Shutter',
      'Camera Portal Pass-Through',
      'Glassmorphic Edge Refraction',
      'Volumetric Light Ray Sweep',
      'Odometer Slot Machine Roll',
    ],
    themeName: 'obsidian-cinematic',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'کنتراست فاکتورهای کاغذی گم‌شده و بایگانی دیجیتال رمزنگاری‌شده',
  },
  {
    id: '12',
    title: 'قطع اینترنت و صندوق تعطیل؟',
    artDirection: 'swiss-editorial',
    layoutTopology: 'asymmetrical-swiss-grid',
    operators: [
      'Baseline Curtain Rise',
      'Animated Highlighter Sweep',
      'Oversized Counter Display',
      'Scramble Decode Cipher',
      'Split-Screen Blade Shutter',
    ],
    themeName: 'swiss-editorial',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'طراحی سوییسی آفلاین: ثبت تراکنش‌ها روی جدول کاغذی دیجیتال تمیز',
  },
  {
    id: '13',
    title: 'انبارگردانی بدون مغایرت و سردرگمی',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'full-bleed-kinetic',
    operators: [
      'Kinetic Elastic Snap',
      'Typographic Mask Video Fill',
      'Text Stagger Velocity Cascade',
      'Kinetic Grid Shifter',
      'Iris Reveal Mask',
    ],
    themeName: 'kinetic-manifesto',
    cardQuotaMax: 0,
    targetCustomer: 'wholesaler',
    description: 'شعار تایپوگرافی غول‌پیکر: صفر مغایرت در انبارگردانی پایان سال',
  },
  {
    id: '14',
    title: 'چک برگشتی و مشتریان بدحساب',
    artDirection: 'procedural-spatial',
    layoutTopology: 'spatial-2.5d-portal',
    operators: [
      'Circuit Path Tracer',
      'Particle Constellation Form',
      'Dual Camera Horizon',
      'Depth Rack Focus',
      'Isometric UI Layer Explosion',
    ],
    themeName: 'procedural-spatial',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    description: 'نقشه اعتبارسنجی فضایی مشتریان و مسیر پیش‌گیری از چک‌های بی‌محل',
  },
  {
    id: '15',
    title: 'محاسبه استهلاک و بهای تمام شده',
    artDirection: 'financial-intelligence',
    layoutTopology: 'data-flow-matrix',
    operators: [
      'Double-Entry Balance Scale',
      'Profit Waterfall Drain',
      'Odometer Slot Machine Roll',
      'Heatmap Inventory Grid',
      'Depth Rack Focus',
    ],
    themeName: 'financial-intelligence',
    cardQuotaMax: 1,
    targetCustomer: 'workshop-producer',
    description: 'ماتریس استهلاک تجهیزات و دارایی‌های ثابت بر مبنای استانداردهای مالی',
  },
  {
    id: '16',
    title: 'چند ارزی و تسویه لحظه‌ای',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'split-screen-horizon',
    operators: [
      'Split-Screen Blade Shutter',
      'Dual Camera Horizon',
      'Camera Portal Pass-Through',
      'Glassmorphic Edge Refraction',
      'Odometer Slot Machine Roll',
    ],
    themeName: 'obsidian-cinematic',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    description: 'جداسازی افقی نوسانات نرخ ارز در بالا و تسویه قطعی حسابچه در پایین',
  },
  {
    id: '17',
    title: 'تولید و فرمول ساخت کارگاهی',
    artDirection: 'swiss-editorial',
    layoutTopology: 'asymmetrical-swiss-grid',
    operators: [
      'Baseline Curtain Rise',
      'Animated Highlighter Sweep',
      'Scramble Decode Cipher',
      'Oversized Counter Display',
      'Double-Entry Balance Scale',
    ],
    themeName: 'swiss-editorial',
    cardQuotaMax: 1,
    targetCustomer: 'workshop-producer',
    description: 'فرمولاسیون مواد اولیه و BOM کارگاهی در چیدمان ژورنالی دقیق',
  },
  {
    id: '18',
    title: 'صندوق‌دار جدید و خطای ورود اطلاعات',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'full-bleed-kinetic',
    operators: [
      'Kinetic Grid Shifter',
      'Text Stagger Velocity Cascade',
      'Typographic Mask Video Fill',
      'Kinetic Elastic Snap',
      'Iris Reveal Mask',
    ],
    themeName: 'kinetic-manifesto',
    cardQuotaMax: 0,
    targetCustomer: 'retail-shopkeeper',
    description: 'برخورد کلمات درشت و تاکید بر آموزش ۵ دقیقه‌ای اپراتور',
  },
  {
    id: '19',
    title: 'بستن سال مالی در ۱۰ ثانیه',
    artDirection: 'procedural-spatial',
    layoutTopology: 'spatial-2.5d-portal',
    operators: [
      'Isometric UI Layer Explosion',
      'Camera Portal Pass-Through',
      'Circuit Path Tracer',
      'Wireframe to Render Solidification',
      'Dual Camera Horizon',
    ],
    themeName: 'procedural-spatial',
    cardQuotaMax: 1,
    targetCustomer: 'accountant',
    description: 'حرکت دوربین از دل اسناد و بستن خودکار دفاتر سود و زیان و ترازنامه',
  },
  {
    id: '20',
    title: 'امنیت پایگاه داده و نسخه پشتیبان رمزنگاری‌شده',
    artDirection: 'financial-intelligence',
    layoutTopology: 'data-flow-matrix',
    operators: [
      'Double-Entry Balance Scale',
      'X-Ray Profit Scanner',
      'Odometer Slot Machine Roll',
      'Dynamic Spotlight Cone',
      'Heatmap Inventory Grid',
    ],
    themeName: 'financial-intelligence',
    cardQuotaMax: 1,
    targetCustomer: 'services',
    description: 'ماتریس جریان داده و رمزنگاری اسناد مالی روی حافظه محلی و ابر',
  },
  {
    id: '21',
    title: 'هر روز فروش داری؛ اما الان دقیقاً چه خبر است؟',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'split-screen-horizon',
    operators: [
      'Split-Screen Blade Shutter',
      'Camera Portal Pass-Through',
      'Dynamic Spotlight Cone',
      'Glassmorphic Edge Refraction',
      'Odometer Slot Machine Roll',
    ],
    themeName: 'obsidian-cinematic',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'شکاف اطلاعاتی جزایر منقطع کسب‌وکار در برابر همگرایی مغناطیسی حسابچه',
  },
  {
    id: '22',
    title: 'فروش داشتی؛ اما واقعاً چقدر سود کردی؟',
    artDirection: 'swiss-editorial',
    layoutTopology: 'asymmetrical-swiss-grid',
    operators: [
      'Profit Waterfall Drain',
      'Baseline Curtain Rise',
      'Animated Highlighter Sweep',
      'Odometer Slot Machine Roll',
      'Double-Entry Balance Scale',
    ],
    themeName: 'swiss-editorial',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    description: 'جدول سوییسی محاسبه حاشیه سود لایه‌ای و تمایز دخل و سود خالص',
  },
  {
    id: '23',
    title: 'موجودی داری؛ اما آیا می‌دانی واقعاً چه داری؟',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'full-bleed-kinetic',
    operators: [
      'Kinetic Elastic Snap',
      'Text Stagger Velocity Cascade',
      'Typographic Mask Video Fill',
      'Iris Reveal Mask',
      'Kinetic Grid Shifter',
    ],
    themeName: 'kinetic-manifesto',
    cardQuotaMax: 0,
    targetCustomer: 'wholesaler',
    description: 'تایپوگرافی جسورانه و کوبنده پیرامون فاجعه کسری انبار بدون کارت‌های تکراری',
  },
  {
    id: '24',
    title: 'اگر فردا یکی از آدم‌های کلیدی نباشد، کسب‌وکارت می‌چرخد؟',
    artDirection: 'procedural-spatial',
    layoutTopology: 'spatial-2.5d-portal',
    operators: [
      'Circuit Path Tracer',
      'Isometric UI Layer Explosion',
      'Particle Constellation Form',
      'Dual Camera Horizon',
      'Depth Rack Focus',
    ],
    themeName: 'procedural-spatial',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'سفر پروازی دوربین در عمق سیستم‌سازی و رهایی از وابستگی به فرد',
  },
  {
    id: '25',
    title: 'تو مدیر کسب‌وکاری؛ یا فقط داری آتش خاموش می‌کنی؟',
    artDirection: 'financial-intelligence',
    layoutTopology: 'data-flow-matrix',
    operators: [
      'Radial Clock Dial & Progress Ring',
      'Double-Entry Balance Scale',
      'Profit Waterfall Drain',
      'Odometer Slot Machine Roll',
      'Heatmap Inventory Grid',
    ],
    themeName: 'financial-intelligence',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'ماتریس هوشمند ره‌گیری زمان، پیش‌بینی بحران‌ها و ساعت آنالوگ تصمیم‌گیری',
  },
  {
    id: '26',
    title: 'کی فاکتور رو پاک کرد؟ ردیابی اسناد و امنیت مالی',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'split-screen-horizon',
    operators: [
      'Split-Screen Blade Shutter',
      'Camera Portal Pass-Through',
      'Glassmorphic Edge Refraction',
      'Volumetric Light Ray Sweep',
      'Odometer Slot Machine Roll',
    ],
    themeName: 'obsidian-cinematic',
    cardQuotaMax: 1,
    targetCustomer: 'services',
    description: 'لاگ امنیتی حسابچه و شناسایی تغییرات پنهانی اسناد',
  },
  {
    id: '27',
    title: 'چک و قسط سررسید؛ وصول بدون فراموشی',
    artDirection: 'swiss-editorial',
    layoutTopology: 'asymmetrical-swiss-grid',
    operators: [
      'Baseline Curtain Rise',
      'Animated Highlighter Sweep',
      'Oversized Counter Display',
      'Double-Entry Balance Scale',
      'Scramble Decode Cipher',
    ],
    themeName: 'swiss-editorial',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    description: 'تقویم تمیز مالی سوییسی بدون زرق و برق؛ وصول به‌موقع مطالبات',
  },
  {
    id: '28',
    title: 'دو مغازه، یک صاحب؛ مدیریت شعب بدون مغایرت',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'full-bleed-kinetic',
    operators: [
      'Split Word Collision',
      'Kinetic Elastic Snap',
      'Text Stagger Velocity Cascade',
      'Typographic Mask Video Fill',
      'Iris Reveal Mask',
    ],
    themeName: 'kinetic-manifesto',
    cardQuotaMax: 0,
    targetCustomer: 'retail-shopkeeper',
    description: 'برخورد کلمات و قدرت مدیریت همزمان چند فروشگاه در یک قاب پرانرژی',
  },
  {
    id: '29',
    title: 'از مواد اولیه تا محصول نهایی؛ حسابداری تولید',
    artDirection: 'procedural-spatial',
    layoutTopology: 'spatial-2.5d-portal',
    operators: [
      'Circuit Path Tracer',
      'Isometric UI Layer Explosion',
      'Magnetic Particle Stream',
      'Dual Camera Horizon',
      'SVG Shape Morphing',
    ],
    themeName: 'procedural-spatial',
    cardQuotaMax: 1,
    targetCustomer: 'workshop-producer',
    description: 'نمای ایزومتریک خط تولید و محاسبه ضایعات و بهای تمام‌شده کارگاهی',
  },
  {
    id: '30',
    title: 'لپ‌تاپ سوخت؛ حساب‌ها چی شد؟ بازیابی فوری',
    artDirection: 'financial-intelligence',
    layoutTopology: 'data-flow-matrix',
    operators: [
      'Double-Entry Balance Scale',
      'X-Ray Profit Scanner',
      'Odometer Slot Machine Roll',
      'Dynamic Spotlight Cone',
      'Heatmap Inventory Grid',
    ],
    themeName: 'financial-intelligence',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'بازیابی آنی پایگاه داده ابری و تداوم کار در ۳۰ ثانیه',
  },
  {
    id: '31',
    title: 'هر روز فروش داری؛ اما الان دقیقاً چه خبر است؟',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'split-screen-horizon',
    operators: [
      'Split-Screen Blade Shutter',
      'Camera Portal Pass-Through',
      'Dynamic Spotlight Cone',
      'Glassmorphic Edge Refraction',
      'Odometer Slot Machine Roll',
    ],
    themeName: 'obsidian-cinematic',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'تحلیل جزایر منقطع اطلاعاتی و نمای متمرکز نقدینگی و نسیه',
  },
  {
    id: '32',
    title: 'فروش داشتی؛ اما واقعاً چقدر سود کردی؟',
    artDirection: 'swiss-editorial',
    layoutTopology: 'asymmetrical-swiss-grid',
    operators: [
      'Profit Waterfall Drain',
      'Baseline Curtain Rise',
      'Animated Highlighter Sweep',
      'Odometer Slot Machine Roll',
      'Double-Entry Balance Scale',
    ],
    themeName: 'swiss-editorial',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    description: 'کالبدشکافی سود ناخالص و خالص در استایل چاپی و گرید ادیتوریال سوییسی',
  },
  {
    id: '33',
    title: 'موجودی داری؛ اما آیا می‌دانی واقعاً چه داری؟',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'full-bleed-kinetic',
    operators: [
      'Kinetic Elastic Snap',
      'Text Stagger Velocity Cascade',
      'Typographic Mask Video Fill',
      'Iris Reveal Mask',
      'Kinetic Grid Shifter',
    ],
    themeName: 'kinetic-manifesto',
    cardQuotaMax: 0,
    targetCustomer: 'wholesaler',
    description: 'شعارها و تایپوگرافی آتشین پیرامون کسری کارتن‌ها و کالاهای خاک‌خورده',
  },
  {
    id: '34',
    title: 'اگر فردا یکی از آدم‌های کلیدی نباشد، کسب‌وکارت می‌چرخد؟',
    artDirection: 'procedural-spatial',
    layoutTopology: 'spatial-2.5d-portal',
    operators: [
      'Circuit Path Tracer',
      'Particle Constellation Form',
      'Dual Camera Horizon',
      'Depth Rack Focus',
      'Isometric UI Layer Explosion',
    ],
    themeName: 'procedural-spatial',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'حرکت در لایه‌های اتوماسیون سازمانی و امنیت وابستگی فرآیندی',
  },
  {
    id: '35',
    title: 'تو مدیر کسب‌وکاری؛ یا فقط داری آتش خاموش می‌کنی؟',
    artDirection: 'financial-intelligence',
    layoutTopology: 'data-flow-matrix',
    operators: [
      'Radial Clock Dial & Progress Ring',
      'Double-Entry Balance Scale',
      'Profit Waterfall Drain',
      'Odometer Slot Machine Roll',
      'Heatmap Inventory Grid',
    ],
    themeName: 'financial-intelligence',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'داشبورد مدیریتی سلامت مالی و ساعت عقربه‌ای پایش بحران‌ها',
  },
  {
    id: '36',
    title: 'سر برج چک داری؛ اما دقیقاً چقدر نقدینگی در دست داری؟',
    artDirection: 'swiss-editorial',
    layoutTopology: 'split-screen-horizon',
    operators: [
      'Baseline Curtain Rise',
      'Double-Entry Balance Scale',
      'Animated Highlighter Sweep',
      'Odometer Slot Machine Roll',
      'Split-Screen Blade Shutter',
    ],
    themeName: 'swiss-editorial',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    description: 'افق سررسید چک‌ها و پیش‌بینی نقدینگی ۳۰ روزه در کادر ادیتوریال',
  },
  {
    id: '37',
    title: 'یک روز کاری کامل: از باز کردن کرکره تا بستن صندوق شب',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'asymmetrical-swiss-grid',
    operators: [
      'Radial Clock Dial & Progress Ring',
      'Kinetic Elastic Snap',
      'Odometer Slot Machine Roll',
      'Split-Screen Blade Shutter',
      'Dynamic Spotlight Cone',
    ],
    themeName: 'kinetic-manifesto',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'ساعت زنده آنالوگ و ۴ ایستگاه زمانی ۹، ۱۳:۳۰، ۱۸ و ۲۱:۳۰ در کادر پویا',
  },
  {
    id: '38',
    title: 'در تورم امروز، آیا واقعاً سود می‌کنی یا داری مالت را ارزان می‌فروشی؟',
    artDirection: 'procedural-spatial',
    layoutTopology: 'full-bleed-kinetic',
    operators: [
      'Profit Waterfall Drain',
      'X-Ray Profit Scanner',
      'Circuit Path Tracer',
      'Odometer Slot Machine Roll',
      'Dual Camera Horizon',
    ],
    themeName: 'procedural-spatial',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    description: 'تایپوگرافی حجیم پیرامون تله سود کاذب و بهای لایه‌ای FIFO',
  },
  {
    id: '39',
    title: 'چند شعبه و انبار داری؛ اما آیا واقعاً از همه جا خبر داری؟',
    artDirection: 'financial-intelligence',
    layoutTopology: 'data-flow-matrix',
    operators: [
      'Circuit Path Tracer',
      'Dual Camera Horizon',
      'Magnetic Particle Stream',
      'Double-Entry Balance Scale',
      'Glassmorphic Edge Refraction',
    ],
    themeName: 'financial-intelligence',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'ماتریس ره‌گیری حواله TR-9402 و سود و زیان تجمیعی شعبات',
  },
  {
    id: '40',
    title: 'اگر وسط شلوغی بازار اینترنت قطع شود، صندوق تو متوقف می‌شود؟',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'spatial-2.5d-portal',
    operators: [
      'Camera Portal Pass-Through',
      'Dual Camera Horizon',
      'Odometer Slot Machine Roll',
      'Wireframe to Render Solidification',
      'Glassmorphic Edge Refraction',
    ],
    themeName: 'obsidian-cinematic',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    description: 'فضای سینمایی آبسیدین، پورتال آفلاین‌فرست SQLite و صندوق ضد قطعی',
  },
  {
    id: '41',
    title: 'اگر هنوز دفتر دستی داری؛ این فاجعه حتمی در کمین توست!',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'split-screen-horizon',
    operators: [
      'Split-Screen Blade Shutter',
      'Kinetic Elastic Snap',
      'Odometer Slot Machine Roll',
      'Dynamic Spotlight Cone',
      'Glassmorphic Edge Refraction',
    ],
    themeName: 'kinetic-manifesto',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'quiet-dread',
    merchantPainCategory: 'tax-audit-penalties',
    audioStrategy: 'restrained-dread',
    description:
      'کابوس انکار بدهی ۳۰۰ میلیونی، فیش محوشده پوز، جریمه مالیات علی‌الرأس و زره ضدگلوله حسابچه',
  },
  {
    id: '42',
    title: 'سر ظهر بار دادی بدون پیش‌پرداخت؛ اگر چک پاس نشود چه بر سرت می‌آید؟',
    artDirection: 'swiss-editorial',
    layoutTopology: 'asymmetrical-swiss-grid',
    operators: [
      'Split-Screen Blade Shutter',
      'Double-Entry Balance Scale',
      'Animated Highlighter Sweep',
      'Odometer Slot Machine Roll',
      'Baseline Curtain Rise',
    ],
    themeName: 'swiss-editorial',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    openingArchetype: 'deadline-pressure',
    merchantPainCategory: 'cheque-domino-collapse',
    audioStrategy: 'rhythmic-urgency',
    description: 'بنکداری و عمده‌فروشی، ریسک عدم وصول چک‌های صیادی و پیش‌بینی نقدینگی ۳۰ روزه',
  },
  {
    id: '43',
    title: 'تولیدی داری؛ اما قطعات گران‌تر از قیمت فروش فاکتور درآمده است!',
    artDirection: 'procedural-spatial',
    layoutTopology: 'full-bleed-kinetic',
    operators: [
      'Circuit Path Tracer',
      'Profit Waterfall Drain',
      'Dual Camera Horizon',
      'Magnetic Particle Stream',
      'Odometer Slot Machine Roll',
    ],
    themeName: 'procedural-spatial',
    cardQuotaMax: 1,
    targetCustomer: 'workshop-producer',
    openingArchetype: 'uncomfortable-discovery',
    merchantPainCategory: 'profit-illusion',
    audioStrategy: 'high-contrast-impact',
    description: 'فرمول ساخت BOM، محاسبه ضایعات و قطعات و شفافیت بهای تمام‌شده صنعتی',
  },
  {
    id: '44',
    title: 'مشتری پای صندوق ایستاده و کالا در انبار شعبه دو مفقود است!',
    artDirection: 'financial-intelligence',
    layoutTopology: 'data-flow-matrix',
    operators: [
      'Circuit Path Tracer',
      'Dual Camera Horizon',
      'Magnetic Particle Stream',
      'Odometer Slot Machine Roll',
      'Split-Screen Blade Shutter',
    ],
    themeName: 'financial-intelligence',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'immediate-consequence',
    merchantPainCategory: 'multi-branch-blindness',
    audioStrategy: 'tactile-foley',
    description: 'مدیریت متمرکز چند شعبه، حواله انتقال بین‌انباری و صفر شدن خطای موجودی قفسه',
  },
  {
    id: '45',
    title: 'شش ماه زحمت کشیدی؛ فاکتورهای دستی گم شد و کارفرما تسویه نمی‌کند!',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'spatial-2.5d-portal',
    operators: [
      'Camera Portal Pass-Through',
      'Dual Camera Horizon',
      'Odometer Slot Machine Roll',
      'Glassmorphic Edge Refraction',
      'Dynamic Spotlight Cone',
    ],
    themeName: 'obsidian-cinematic',
    cardQuotaMax: 1,
    targetCustomer: 'services',
    openingArchetype: 'customer-confrontation',
    merchantPainCategory: 'untracked-receivables',
    audioStrategy: 'restrained-dread',
    description: 'پیمانکاری و خدمات، صورت‌وضعیت رسمی دیجیتال و پایان سوخت شدن هزینه‌ها',
  },
  {
    id: '46',
    title: 'دخلت پر از تراول است؛ اما آیا واقعاً سود کردی یا سرمایه‌ات آب رفت؟',
    artDirection: 'swiss-editorial',
    layoutTopology: 'split-screen-horizon',
    operators: [
      'X-Ray Profit Scanner',
      'Profit Waterfall Drain',
      'Double-Entry Balance Scale',
      'Odometer Slot Machine Roll',
      'Split-Screen Blade Shutter',
    ],
    themeName: 'swiss-editorial',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'uncomfortable-discovery',
    merchantPainCategory: 'profit-illusion',
    audioStrategy: 'tactile-foley',
    description: 'توهم سود دخل شلوغ، محاسبه سود لایه‌ای FIFO و جلوگیری از آب رفتن سرمایه در تورم',
  },
  {
    id: '47',
    title: 'حسابداری دقیق کسب‌وکار با حسابچه (نوار قطاری عمودی و کلاژ کاغذی)',
    artDirection: 'procedural-spatial',
    layoutTopology: 'asymmetrical-swiss-grid',
    operators: [
      'Vertical Train Canvas',
      'Dashed Bezier Connectors',
      'Tactile Paper Collage',
      'Hand-Drawn Highlighter Loop',
      'Fast-Spinning Analog Clock',
    ],
    themeName: 'procedural-spatial',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'visual-pattern-interrupt',
    merchantPainCategory: 'untracked-receivables',
    audioStrategy: 'tactile-foley',
    viralTemplate: 'tactile-train-scroll',
    description: 'بوم عمودی پیوسته، کلاژ کاغذی، فلش‌های منحنی نقطه‌چین، و زوم‌اوت ماکرو ثانیه ۵۴',
  },
  {
    id: '48',
    title: 'مشتری می‌گه کارت کشیدم؛ ولی دستگاه مغازه فیش نداده!',
    artDirection: 'financial-intelligence',
    layoutTopology: 'data-flow-matrix',
    operators: [
      'Split-Screen Blade Shutter',
      'Odometer Slot Machine Roll',
      'Double-Entry Balance Scale',
      'Dynamic Spotlight Cone',
      'Circuit Path Tracer',
    ],
    themeName: 'financial-intelligence',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'customer-confrontation',
    merchantPainCategory: 'offline-pos-paralysis',
    audioStrategy: 'high-contrast-impact',
    viralTemplate: 'thermal-receipt-scroll',
    description:
      'خطای اتصال کارتخوان، فیش ندادن دستگاه، برزخ مغایرت ۷۲ ساعته شاپرک، و صدور فاکتور امانی هوشمند حسابچه',
  },
  {
    id: '49',
    title: 'بار ۵۰۰ میلیونی رو نسیه دادی؛ ولی پای تسویه، نصف سرمایه‌ت پودر شد!',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'full-bleed-kinetic',
    operators: [
      'Kinetic Typographic Mask',
      'Spatial Depth Rig',
      'Replacement Cost Scanner',
      'Split-Screen Blade Shutter',
      'Double-Entry Balance Scale',
    ],
    themeName: 'cinematic-obsidian',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    openingArchetype: 'uncomfortable-discovery',
    merchantPainCategory: 'profit-illusion',
    audioStrategy: 'rhythmic-urgency',
    viralTemplate: 'premium-motion-graphics',
    description:
      'فروش نسیه در بازار تورمی، سراب سود کاغذی، پایش لحظه‌ای ارزش جایگزینی انبار و شرط تعدیل هوشمند نرخ در فاکتور',
  },
  {
    id: '50',
    title: 'پولت کجا می‌ره؟ فروش داشتی… ولی سودت کجاست؟',
    artDirection: 'procedural-spatial',
    layoutTopology: 'spatial-2.5d-portal',
    operators: [
      'Spatial Depth Rig',
      'Double-Entry Balance Scale',
      'Dynamic Spotlight Cone',
      'Split-Screen Blade Shutter',
      'Circuit Path Tracer',
    ],
    themeName: 'procedural-spatial',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'quiet-dread',
    merchantPainCategory: 'untracked-receivables',
    audioStrategy: 'restrained-dread',
    viralTemplate: 'infinite-spatial-board',
    description:
      'فیلم تبلیغاتی سینمایی ۳۰ ثانیه‌ای: پایان روز، دخل باز، نشت پنهان نسیه و کسری انبار، و آرامش ۴ ستون واقعی حسابچه',
  },
  {
    id: '51',
    title: 'وانت باربری دم در منتظره؛ اما کارتن‌ها تو انبار نیست!',
    artDirection: 'swiss-editorial',
    layoutTopology: 'asymmetrical-swiss-grid',
    operators: [
      'Baseline Curtain Rise',
      'Animated Highlighter Sweep',
      'Odometer Slot Machine Roll',
      'Isometric UI Layer Explosion',
      'Iris Reveal Mask',
    ],
    themeName: 'swiss-editorial',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    openingArchetype: 'immediate-consequence',
    merchantPainCategory: 'inventory-discrepancy',
    audioStrategy: 'high-contrast-impact',
    viralTemplate: 'vox-documentary-collage',
    description:
      'وانت باربری دم در دوبله پارک کرده، مغایرت کاردکس انبار و فروش کاغذی بدون کسر لحظه‌ای، و ثبت اتمیک فاکتور حسابچه با قفل موجودی',
  },
  {
    id: '52',
    title: '۳۰۰ میلیون فروختی؛ اما چرا موجودی بانکت فقط ۲ میلیونه؟',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'split-screen-horizon',
    operators: [
      'HighlighterSweep',
      'OdometerRoll',
      'IsometricLayerExplosion',
      'BaselineCurtainRise',
      'IrisReveal',
    ],
    themeName: 'kinetic-manifesto',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'uncomfortable-discovery',
    merchantPainCategory: 'untracked-receivables',
    audioStrategy: 'rhythmic-urgency',
    viralTemplate: 'split-screen-stopwatch',
    description:
      'فروش ۳۰۰ میلیونی اما حساب بانکی خالی ۲ میلیونی، فردا موعد پرداخت تامین‌کننده، ردیابی ۲۳۰ میلیون طلب قفل‌شده بازار با گزارش لحظه‌ای بدهکاران حسابچه',
  },
  {
    id: '53',
    title: 'سناریوی کلمه‌به‌کلمه: فروشت زیاده؛ اما آخر ماه پولت کجاست؟',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'data-flow-matrix',
    operators: [
      'HighlighterSweep',
      'OdometerRoll',
      'IsometricLayerExplosion',
      'BaselineCurtainRise',
      'IrisReveal',
    ],
    themeName: 'cinematic-obsidian',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'immediate-consequence',
    merchantPainCategory: 'untracked-receivables',
    audioStrategy: 'rhythmic-urgency',
    viralTemplate: 'tactile-train-scroll',
    description:
      'سناریوی کلمه‌به‌کلمه و رویدادمحور: با فروش ۳۰۰ میلیونی شروع و با اما نمودار می‌شکند، سپس انبار، طلب مشتری‌ها و خرج‌ها ظاهر و در داشبورد حسابچه یکجا قفل می‌شوند',
  },
  {
    id: '54',
    title: 'ساعت ۱۲ ظهر موعد پاس شدن چکته؛ اما حسابت خالیه!',
    artDirection: 'financial-intelligence',
    layoutTopology: 'spatial-2.5d-portal',
    operators: [
      'HighlighterSweep',
      'OdometerRoll',
      'IsometricLayerExplosion',
      'BaselineCurtainRise',
      'IrisReveal',
    ],
    themeName: 'financial-intelligence',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    openingArchetype: 'deadline-pressure',
    merchantPainCategory: 'cheque-domino-collapse',
    audioStrategy: 'high-contrast-impact',
    viralTemplate: 'chat-panic-to-calm',
    description:
      'سناریوی کلمه‌به‌کلمه و قلاب نفس‌گیر: شمارش معکوس به ۱۲:۰۰ ظهر، چک صیادی ۶۰۰ میلیونی در آستانه برگشت، قفل ۴۳۰ میلیون در نسیه بازار، و وصول خودکار با یادآور پیامکی و راس‌گیری حسابچه',
  },
  {
    id: '55',
    title: 'انبارت پره، ولی جیبت خالیه!',
    artDirection: 'procedural-spatial',
    layoutTopology: 'full-bleed-kinetic',
    operators: [
      'KineticColorInversion',
      'ThermalDeadstockAudit',
      'IsometricDepthExplosion',
      'LiquidGlassTerminal',
      'ReceiptZeroGauge',
    ],
    themeName: 'procedural-spatial',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'visual-pattern-interrupt',
    merchantPainCategory: 'inventory-discrepancy',
    audioStrategy: 'tactile-foley',
    viralTemplate: 'isometric-exploded-ui',
    description:
      'سناریوی کلمه‌به‌کلمه ترکیبی: قفسه‌های پر در برابر جیب خالی، رسید حرارتی کالای بی‌حرکت با میانگین عمر ۱۲۰ روز، کالبدشکافی ایزومتریک ۵ لایه انبار، و آزادسازی ۴۰۰ میلیون سرمایه راکد در ترمینال شیشه‌ای حسابچه',
  },
  {
    id: '56',
    title: 'دو شعبه داری؛ ولی کدوم یکی داره ضرر می‌سازه؟',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'split-screen-horizon',
    operators: [
      'ContinuousLineThread',
      'ZeroLineProfitSplit',
      'DualBranchTickers',
      'LeakFrayDetector',
      'LoopbackCtaOrbit',
    ],
    themeName: 'kinetic-manifesto',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'uncomfortable-discovery',
    merchantPainCategory: 'multi-branch-blindness',
    audioStrategy: 'high-contrast-impact',
    viralTemplate: 'continuous-line-traveler',
    description:
      'سناریوی کلمه‌به‌کلمه پیوسته: نخ درخشان پول به دو شعبه شاخه می‌زند، فروش جمعی ۹۰۰ میلیونی در برابر هزینه‌های ۸۶۰ میلیونی، افت شعبه مرکزی ۲۰ میلیون زیر خط صفر، و گزارش تفکیکی سود و زیان هر شعبه در حسابچه',
  },
  {
    id: '57',
    title: 'فاکتور ۷۵ میلیونی دیروز کجاست؟ کی ویرایشش کرد؟',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'data-flow-matrix',
    operators: [
      'ForensicInvoiceDiff',
      'TamperSlashStrike',
      'AuditStreamTimeline',
      'PermissionShieldLock',
      'VaultSecurityDoor',
    ],
    themeName: 'cinematic-obsidian',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'immediate-consequence',
    merchantPainCategory: 'profit-illusion',
    audioStrategy: 'tactile-foley',
    viralTemplate: 'liquid-glass-spatial',
    description:
      'کالبدشکافی تخلف و امنیت صندوق: فاکتور ۷۵ میلیونی اولیه که بی‌اجازه به ۴۵ میلیون ویرایش شده، کسری ۳۰ میلیونی نقد، مقایسه با آسیب‌پذیری اکسل، و سپر حفاظتی لاگ تغییرات حسابچه با قفل دو مرحله‌ای مدیر',
  },
  {
    id: '58',
    title: 'قطع اینترنت و ۴۰ مشتری در صف؛ دخل متوقف شد؟',
    artDirection: 'procedural-spatial',
    layoutTopology: 'spatial-2.5d-portal',
    operators: [
      'OfflineResilienceEngine',
      'InstantSyncQueue',
      'LocalVaultStorage',
      'ZeroBlackoutPos',
      'QueueDispersalBeacon',
    ],
    themeName: 'procedural-spatial',
    cardQuotaMax: 1,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'uncomfortable-discovery',
    merchantPainCategory: 'offline-pos-paralysis',
    audioStrategy: 'rhythmic-urgency',
    viralTemplate: 'isometric-exploded-ui',
    description:
      'بحران قطعی اینترنت در اوج شلوغی فروشگاه: ۴۰ مشتری در صف صندوق، قفل شدن نرم‌افزارهای ابری وابسته به نت، و پایداری ۱۰۰٪ موتور آفلاین حسابچه با صدور فاکتور زیر ۲ ثانیه و همگام‌سازی خودکار در پس‌زمینه',
  },
  {
    id: '59',
    title: 'برگ تشخیص مالیات ۱۸۰ میلیونی رسید؛ چرا دفاتر رد شد؟',
    artDirection: 'financial-intelligence',
    layoutTopology: 'full-bleed-kinetic',
    operators: [
      'MoadianDirectConnector',
      'FiscalCodeGenerator',
      'TaxAuditShield',
      'ZeroPenaltyLedger',
      'OneClickTaxTransmitter',
    ],
    themeName: 'financial-intelligence',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    openingArchetype: 'deadline-pressure',
    merchantPainCategory: 'tax-audit-penalties',
    audioStrategy: 'high-contrast-impact',
    viralTemplate: 'swiss-financial-terminal',
    description:
      'بحران ممیزی دارایی و جریمه کتمان درآمد: برگ تشخیص ۱۸۰ میلیونی به دلیل رد دفاتر سنتی و مغایرت با سامانه مودیان، نقص اکسل در تولید کد رهگیری ۲۲ رقمی، و ارسال مستقیم فاکتور الکترونیک با یک کلیک در حسابچه با صفر ریال جریمه',
  },
  {
    id: '60',
    title: 'دالر بالا رفت؛ ۴٬۰۰۰ افغانی کجا رفت؟',
    artDirection: 'swiss-editorial',
    layoutTopology: 'asymmetrical-swiss-grid',
    operators: [
      'RateFreezeOnInvoice',
      'DayRatePayment',
      'FxGainLossPosting',
      'OverwrittenRateStrike',
      'MonotonicOdometer',
    ],
    themeName: 'midnight-gold',
    cardQuotaMax: 3,
    targetCustomer: 'wholesaler',
    openingArchetype: 'uncomfortable-discovery',
    merchantPainCategory: 'profit-illusion',
    audioStrategy: 'tactile-foley',
    description:
      'فاکتور هزار دالری به نرخ ۷۰ صادر و به نرخ ۷۴ پرداخت شد: دفتر ۷۰٬۰۰۰، صندوق ۷۴٬۰۰۰، و ۴٬۰۰۰ افغانی اختلاف که در اکسل با بازنویسی نرخ گم شد. حسابچه نرخ فاکتور را نگه می‌دارد و اختلاف را خودکار به سود و زیان تسعیر ارز می‌برد',
  },
  {
    id: '61',
    title: 'اون کارتن کجاست؟',
    artDirection: 'kinetic-manifesto',
    layoutTopology: 'data-flow-matrix',
    viralTemplate: 'chat-panic-to-calm',
    operators: [
      'CallWaveformMorph',
      'WarehouseRackScan',
      'DetachingNoteVisual',
      'ShelfLocationFlip',
      'CenteredBrandHold',
    ],
    themeName: 'cyber-emerald',
    cardQuotaMax: 1,
    targetCustomer: 'wholesaler',
    openingArchetype: 'uncomfortable-discovery',
    merchantPainCategory: 'inventory-discrepancy',
    audioStrategy: 'tactile-foley',
    description:
      'بنکدار ده دقیقه پشت تلفن داد می‌زند تا ۲۰ کارتن روغن را پیدا کند؛ مشتری پشت خط منتظر است و آدرس قفسه فقط در ذهن یک انباردار است. در حسابچه صفحه‌ی کالا انبار و قفسه را نشان می‌دهد و قفسه همان‌جا عوض می‌شود',
  },
  {
    id: '62',
    title: 'زایش فاکتور از دل پرینتر حرارتی',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'spatial-2.5d-portal',
    viralTemplate: 'thermal-receipt-scroll',
    operators: [
      'ThermalReceiptSlot',
      'ContinuousPaperUnroll',
      'SerratedTearReveal',
      'QuadCardSplit',
      'EquilibriumShieldLock',
    ],
    themeName: 'obsidian-cinematic',
    cardQuotaMax: 3,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'visual-pattern-interrupt',
    merchantPainCategory: 'profit-illusion',
    audioStrategy: 'tactile-foley',
    description:
      'در خرده‌فروشی سنتی رسید کاغذی پای پیشخوان چاپ می‌شود اما آخر شب باید ساعت‌ها صرف ورود دستی فاکتورها در اکسل و شمارش کسری دخل شود. در حسابچه همزمان با خروج فیش، انبار کسر و دخل شارژ شده و ترازنامه متوازن ثبت می‌شود',
  },
  {
    id: '63',
    title: 'گرم و مظنه و اجرت؛ قیمت این گردنبند چنده؟',
    artDirection: 'financial-intelligence',
    layoutTopology: 'split-screen-horizon',
    viralTemplate: 'swiss-financial-terminal',
    operators: [
      'GramScaleReadout',
      'RateLockSeal',
      'WeightFlowConduit',
      'ComponentExplodeRack',
      'LaborWageChip',
    ],
    themeName: 'midnight-gold',
    cardQuotaMax: 2,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'customer-confrontation',
    merchantPainCategory: 'profit-illusion',
    audioStrategy: 'rhythmic-urgency',
    description:
      'در طلافروشی قیمت هر گرم لحظه‌ای عوض می‌شود و جمع مظنه، عیار، وزن و اجرت ساخت با ماشین‌حساب دستی، ریسک قیمت اشتباه و سود ناپیدا دارد. در حسابچه طلا به گرم ثبت می‌شود، نرخ روز روی فاکتور قفل می‌ماند و قطعات گردنبند (زنجیر، سنگ، اجرت) جدا حساب می‌شوند',
  },
  {
    id: '64',
    title: 'کوری بهای تمام‌شده کارگاه',
    artDirection: 'swiss-editorial',
    layoutTopology: 'single-focal-stage',
    viralTemplate: 'kinetic-color-block',
    operators: [
      'CogsWaterfallDeconstruct',
      'IntuitivePricingFracture',
      'ScrapLossCalculator',
      'BomAssemblyEngine',
      'MarginLockBadge',
    ],
    themeName: 'swiss-editorial',
    cardQuotaMax: 2,
    targetCustomer: 'workshop-producer',
    openingArchetype: 'uncomfortable-discovery',
    merchantPainCategory: 'profit-illusion',
    audioStrategy: 'high-contrast-impact',
    description:
      'تولیدکننده کارگاهی با فروش ۱۰۰ صندلی در ماه رکورد می‌زند اما دخلش خالی است چون قیمت ۶۰۰ هزار تومانی را حسی حساب کرده و ضایعات، چسب و یراق را ندیده است. فرمول ساخت (BOM) حسابچه بهای ساخت را ۶۵۰ هزار نشان داده و با قیمت ۸۵۰ هزار، سود خالص را تضمین می‌کند',
  },
  {
    id: '65',
    title: 'سه صندلی پر؛ اما شب فقط یک عدد می‌بینی',
    artDirection: 'cinematic-obsidian',
    layoutTopology: 'data-flow-matrix',
    operators: [
      'StationWallMeters',
      'HandwrittenRowStamp',
      'LiveChairAttribution',
      'ConsumableDeductRow',
      'NightCloseProfitSplit',
    ],
    themeName: 'obsidian-cinematic',
    cardQuotaMax: 2,
    targetCustomer: 'services',
    openingArchetype: 'quiet-dread',
    merchantPainCategory: 'profit-illusion',
    audioStrategy: 'restrained-dread',
    description:
      'در سالن زیبایی با سه صندلی، هر صندلی تمام روز کار می‌کند اما شب که کتاب بسته می‌شود فقط یک عدد کل فروش دیده می‌شود. در حسابچه هر خدمت روی صندلی خودش می‌نشیند، محصولات مصرفی همان صندلی جدا کسر می‌شود و بستن شیفت سود واقعی هر ایستگاه را نشان می‌دهد — از جمله صندلی‌ای که تمام شب ضرر داده است',
  },
  {
    id: '66',
    title: 'یک شخصیت از حسابچه می‌گوید: کاسب خواربار و لوازم خانگی',
    artDirection: 'procedural-spatial',
    layoutTopology: 'spatial-2.5d-portal',
    viralTemplate: 'liquid-glass-spatial',
    operators: [
      'PaperPileSwirlTransform',
      'InvoiceQuadSplitMatrix',
      'CustomerReceivableTimeline',
      'OfflineQueueCloudSync',
      'UnifiedShopkeeperDashboard',
    ],
    themeName: 'cyber-emerald',
    cardQuotaMax: 3,
    targetCustomer: 'retail-shopkeeper',
    openingArchetype: 'immediate-consequence',
    merchantPainCategory: 'untracked-receivables',
    audioStrategy: 'tactile-foley',
    description:
      'کاسب خواربار با کوهی از فاکتور کاغذی آخر روز سودش را نمی‌داند. در حسابچه ثبت یک فاکتور همزمان انبار، صندوق، حساب مشتری و سند دوبل دفتر را به‌روز می‌کند؛ با قطع اینترنت فروش متوقف نمی‌شود و گردش نسیه هر مشتری با یک نگاه شفاف است',
  },
]

// Ensure every entry in the registry carries its designated viral template
for (const entry of REEL_REGISTRY_LIST) {
  if (!entry.viralTemplate) {
    entry.viralTemplate = getReelViralTemplate(entry.id)
  }
}

export const REEL_REGISTRY: Record<string, ReelRegistryEntry> = Object.fromEntries(
  REEL_REGISTRY_LIST.map((entry) => [entry.id, entry]),
)

// ─── Dynamic Template & Similarity Guardrails ───────────────────────────────

export interface SimilarityCheckResult {
  score: number
  reasons: string[]
  passed: boolean
}

/**
 * Computes a weighted similarity score between two reel definitions.
 * Maximum threshold is 35% for adjacent reels.
 */
export function computeCreativeSimilarity(
  a: ReelRegistryEntry,
  b: ReelRegistryEntry,
): SimilarityCheckResult {
  let score = 0
  const reasons: string[] = []

  // 1. Opening Archetype (25% weight)
  if (a.openingArchetype && b.openingArchetype && a.openingArchetype === b.openingArchetype) {
    score += 0.25
    reasons.push(`Same opening archetype: '${a.openingArchetype}' (+25%)`)
  }

  // 2. Layout Topology (25% weight)
  if (a.layoutTopology === b.layoutTopology) {
    score += 0.25
    reasons.push(`Same layout topology: '${a.layoutTopology}' (+25%)`)
  }

  // 3. Art Direction (20% weight)
  if (a.artDirection === b.artDirection) {
    score += 0.2
    reasons.push(`Same art direction: '${a.artDirection}' (+20%)`)
  }

  // 4. Merchant Pain Category (15% weight)
  if (
    a.merchantPainCategory &&
    b.merchantPainCategory &&
    a.merchantPainCategory === b.merchantPainCategory
  ) {
    score += 0.15
    reasons.push(`Same pain category: '${a.merchantPainCategory}' (+15%)`)
  }

  // 5. Audio Strategy (10% weight)
  if (a.audioStrategy && b.audioStrategy && a.audioStrategy === b.audioStrategy) {
    score += 0.1
    reasons.push(`Same audio strategy: '${a.audioStrategy}' (+10%)`)
  }

  // 6. Operator Overlap (5% weight)
  const setB = new Set(b.operators)
  const common = a.operators.filter((op) => setB.has(op))
  const overlapRatio = a.operators.length > 0 ? common.length / a.operators.length : 0
  if (overlapRatio > 0.6) {
    score += 0.05
    reasons.push(`High operator overlap: ${common.length}/${a.operators.length} (+5%)`)
  }

  return {
    score,
    reasons,
    passed: score <= 0.35,
  }
}

/**
 * Validates that currentLayout does not match any of the last 3 rendered topologies.
 * If a match occurs, throws an explicit error forcing a topology switch.
 */
export function assertNoLayoutRepetition(
  currentLayout: LayoutTopology,
  recentLayouts: LayoutTopology[],
  reelId?: string,
): void {
  const windowOf3 = recentLayouts.slice(-3)
  const duplicate = windowOf3.find((prev) => prev === currentLayout)
  if (duplicate) {
    throw new Error(
      `[Template Trap Guardrail Violation] Reel ${reelId ?? 'UNKNOWN'} uses layout topology '${currentLayout}', which matches recent layout in the last 3 reels ([${windowOf3.join(
        ', ',
      )}]). A topology switch is required.`,
    )
  }
}

/**
 * Validates the full reel registry sequence against all studio governance rules:
 * 1. Window of 3 rule: No layout topology matches any of the previous 3 reels.
 * 2. No consecutive reels share the same art direction.
 * 3. Weighted creative similarity check: adjacent reels must not exceed 35% similarity.
 * 4. Pairwise distinction: Reel 10, Reel 22, and Reel 40 must have pairwise distinct
 *    art directions AND pairwise distinct layout topologies.
 */
export function validateReelRegistry(entries: ReelRegistryEntry[] = REEL_REGISTRY_LIST): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  for (let i = 0; i < entries.length; i++) {
    const current = entries[i]!
    const recent = entries.slice(Math.max(0, i - 3), i).map((e) => e.layoutTopology)
    if (recent.includes(current.layoutTopology)) {
      errors.push(
        `Reel ${current.id} topology '${current.layoutTopology}' repeats within last 3 reels: [${recent.join(', ')}]`,
      )
    }
    if (i > 0 && entries[i - 1]!.artDirection === current.artDirection) {
      errors.push(
        `Reel ${current.id} art direction '${current.artDirection}' matches consecutive Reel ${entries[i - 1]!.id}`,
      )
    }
    if (i > 0 && current.viralTemplate && entries[i - 1]!.viralTemplate === current.viralTemplate) {
      errors.push(
        `Reel ${current.id} viral template '${current.viralTemplate}' matches consecutive Reel ${entries[i - 1]!.id}`,
      )
    }
    if (i > 0) {
      const prev = entries[i - 1]!
      const sim = computeCreativeSimilarity(current, prev)
      if (!sim.passed) {
        errors.push(
          `Reel ${current.id} creative similarity to adjacent Reel ${prev.id} is ${(sim.score * 100).toFixed(0)}% (exceeds 35% threshold): [${sim.reasons.join(', ')}]`,
        )
      }
    }
  }

  // Ensure Reel 10, Reel 22, and Reel 40 are pairwise distinct
  const r10 = entries.find((e) => e.id === '10')
  const r22 = entries.find((e) => e.id === '22')
  const r40 = entries.find((e) => e.id === '40')

  if (r10 && r22 && r40) {
    if (
      r10.artDirection === r22.artDirection ||
      r10.artDirection === r40.artDirection ||
      r22.artDirection === r40.artDirection
    ) {
      errors.push(
        `Reels 10, 22, 40 must have pairwise distinct art directions: 10=${r10.artDirection}, 22=${r22.artDirection}, 40=${r40.artDirection}`,
      )
    }
    if (
      r10.layoutTopology === r22.layoutTopology ||
      r10.layoutTopology === r40.layoutTopology ||
      r22.layoutTopology === r40.layoutTopology
    ) {
      errors.push(
        `Reels 10, 22, 40 must have pairwise distinct layout topologies: 10=${r10.layoutTopology}, 22=${r22.layoutTopology}, 40=${r40.layoutTopology}`,
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Retrieves registry metadata for a given reel ID.
 */
export function getReelRegistryEntry(id: string): ReelRegistryEntry {
  const normalized = id.padStart(2, '0')
  const entry = REEL_REGISTRY[normalized]
  if (!entry) {
    throw new Error(`Reel ID '${id}' not found in REEL_REGISTRY.`)
  }
  return entry
}

export function getArtDirection(id: string): ArtDirection {
  return getReelRegistryEntry(id).artDirection
}

export function getLayoutTopology(id: string): LayoutTopology {
  return getReelRegistryEntry(id).layoutTopology
}

export function getViralTemplate(id: string): ViralTemplateId {
  const entry = getReelRegistryEntry(id)
  return entry.viralTemplate ?? getReelViralTemplate(id)
}

// Self-executing dynamic template guardrail check at module initialization
const validationResult = validateReelRegistry(REEL_REGISTRY_LIST)
if (!validationResult.valid) {
  throw new Error(`[REEL_REGISTRY Guardrail Failure]\n${validationResult.errors.join('\n')}`)
}
