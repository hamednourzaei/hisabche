// ============================================
// Video 01: ابری یا سنتی؟ (58s)
// Funnel stage: Awareness / Introduction | Audience: All business owners
// Scenario 01 from SCENARIOS.md:
// - Hook (0–4s): «کسب‌وکار من… نرم‌افزار ابری می‌خواد یا سنتی؟»
// - Branch (4–9s): دوراهی: چرا فقط یکی؟ آنلاین در وب + آفلاین در اپ
// - Stagger (9–16s): یک فاکتور، شش ثبت هم‌زمان
// - Hub (16–24s): هسته حسابچه و ۸ گره کسب‌وکار
// - Compare (24–34s): مقایسه ۳ ستونه: اکسل و دفتر / سنتی / حسابچه
// - Bridge (34–43s): پل ابری و آفلاین در یک سیستم
// - CTA (43–58s): دعوت دوگانه: رایگان / حسابچه
// Theme: Dark Obsidian Cinematic
// ============================================

import type { Reel } from '../engine/types'
import { COMPARE_COLUMNS, ctaScene, sequence, total } from './shared'

const scenes = sequence([
  {
    dur: 4,
    spec: {
      kind: 'hook',
      label: 'انتخاب نرم‌افزار مالی',
      lines: ['کسب‌وکار من…', 'نرم‌افزار [c:ابری] می‌خواد یا [p:سنتی]؟'],
      cards: [
        { icon: 'cloud', title: 'ابری و آنلاین', sub: 'دسترسی از هر کجا', tone: 'cyan' },
        { icon: 'laptop', title: 'سنتی و آفلاین', sub: 'کار پای صندوق بدون نت', tone: 'purple' },
      ],
    },
    vo: 'حساب‌وکتاب بیزینس من، نرم‌افزار ابری می‌خواد یا سنتی و آفلاین؟',
  },
  {
    dur: 5,
    spec: {
      kind: 'branch',
      cards: [
        { icon: 'cloud', title: 'ابری و آنلاین', sub: 'دسترسی از هر کجا', tone: 'cyan' },
        { icon: 'laptop', title: 'سنتی و آفلاین', sub: 'کار پای صندوق بدون نت', tone: 'purple' },
      ],
      question: 'چرا فقط یکی؟',
      answer: 'هر دو در یک حسابچه',
      badge: 'آنلاین در وب + آفلاین در اپ',
    },
    vo: 'چرا فقط یکی؟ با حسابچه، در وب آنلاین کار کن و در اپ، وقتی اینترنت قطع شد، بدون توقف فاکتور بزن.',
  },
  {
    dur: 7,
    spec: {
      kind: 'stagger',
      title: 'فقط [c:یک فاکتور] ثبت کن',
      header: ['شش ثبت هم‌زمان', 'اتصال آنی'],
      rows: [
        { icon: 'receipt', text: 'فروش نقد و نسیه' },
        { icon: 'wallet', text: 'صندوق و بانک' },
        { icon: 'boxes', text: 'موجودی انبار' },
        { icon: 'book', text: 'سند دوطرفه دفتر کل' },
        { icon: 'trend', text: 'سود واقعی فاکتور' },
        { icon: 'sync', text: 'همگام‌سازی اپ و وب' },
      ],
      interval: 0.8,
      tone: 'cyan',
    },
    vo: 'فقط یک فاکتور ثبت کن؛ صندوق، انبار، دفتر کل و سود، همه خودشان به‌روز می‌شوند.',
  },
  {
    dur: 8,
    spec: {
      kind: 'hub',
      title: 'از یک مغازه تا [p:کارگاه و چند انبار]',
      core: 'حسابچه',
      coreSub: 'هسته داده',
      nodes: [
        { icon: 'store', label: 'فروشگاه' },
        { icon: 'truck', label: 'عمده‌فروشی' },
        { icon: 'boxes', label: 'انبارها' },
        { icon: 'factory', label: 'تولید' },
        { icon: 'calculator', label: 'خدمات' },
        { icon: 'users', label: 'تیم' },
        { icon: 'book', label: 'دفتر کل' },
        { icon: 'sparkles', label: 'دستیار هوشمند' },
      ],
    },
    vo: 'از یک مغازه تا کارگاه و چند انبار، همه در یک هسته.',
  },
  {
    dur: 10,
    spec: {
      kind: 'compare',
      title: 'تفاوت واقعی [c:از این‌جا شروع می‌شود]',
      columns: COMPARE_COLUMNS,
      rows: [
        { label: 'کار بدون اینترنت (در اپ)', marks: ['no', 'yes', 'yes'] },
        { label: 'دسترسی آنلاین از هرجا', marks: ['part', 'no', 'yes'] },
        { label: 'همگام‌سازی خودکار', marks: ['no', 'no', 'yes'] },
        { label: 'سند دوطرفه خودکار', marks: ['no', 'yes', 'yes'] },
        { label: 'سود واقعی هر فاکتور', marks: ['no', 'part', 'yes'] },
        { label: 'پشتیبانی از چند ارز', marks: ['part', 'part', 'yes'] },
      ],
      interval: 1.1,
    },
    vo: 'تفاوت واقعی از اینجا شروع می‌شود.',
  },
  {
    dur: 9,
    spec: {
      kind: 'bridge',
      title: 'ابری + آفلاین؛ [c:در یک حسابچه]',
      left: { icon: 'cloud', title: 'ابری و آنلاین', tone: 'cyan' },
      right: { icon: 'laptop', title: 'آفلاین در اپ', tone: 'purple' },
      merged: 'حسابچه',
      caption: 'سادگی برای مدیر، دقت برای حسابدار',
      summaries: [
        {
          question: 'برای مدیر و فروشنده',
          answer: 'سادگی و سرعت کار روزانه',
          tone: 'cyan',
          icons: ['store', 'sparkles'],
        },
        {
          question: 'برای حسابدار و شریک',
          answer: 'دقت در سند دوبل و ترازنامه',
          tone: 'purple',
          icons: ['book', 'check'],
        },
      ],
    },
    vo: 'سادگی برای مدیر، دقت برای حسابدار.',
  },
  ctaScene(15),
])

export const reel01: Reel = {
  id: '01',
  title: 'ابری یا سنتی؟',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
}
