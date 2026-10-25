// ============================================
// Reel 74: Manufacturing BOM - Accurate Unit Costing
// Motion Template: swiss-financial-terminal
// Funnel Stage: Value Creation | Audience: Manufacturers, Workshop Producers, Food & Bakeries
// ============================================

import type { Reel } from '../engine/types'
import { COMPARE_COLUMNS, ctaScene, sequence, total } from './shared'

const scenes = sequence(
  [
    {
      dur: 4,
      spec: {
        kind: 'hook',
        label: 'سیستم تولید و کارگاهی',
        lines: ['کارگاه شلوغه و تولید بالاست،', 'ولی [r:قیمت تمام‌شده رو حدسی می‌زنی]!'],
        cards: [
          { icon: 'factory', title: 'مواد خام و اولیه', sub: '۳ قلم ماده مصرفی', tone: 'cyan' },
          {
            icon: 'wallet',
            title: 'بهای تمام‌شده هر واحد',
            sub: 'نامشخص در کارگاه سنتی',
            tone: 'red',
          },
        ],
      },
      vo: 'تولید می‌کنی و می‌فروشی، اما نمی‌دونی هر دانه محصول چقدر برات آب خورده؟',
    },
    {
      dur: 8,
      spec: {
        kind: 'swiss-terminal',
        title: 'ترمینال فرمول ساخت و بهای تمام‌شده واقعی (BOM)',
      },
      vo: 'در حسابچه فرمول ساخت می‌سازی؛ با هر دستور تولید، مواد اولیه از انبار کسر و کالای نهایی دقیق ثبت می‌شه.',
    },
    {
      dur: 8,
      spec: {
        kind: 'compare',
        title: 'تولید سنتی در برابر [c:سیستم تولید حسابچه]',
        columns: COMPARE_COLUMNS,
        rows: [
          { label: 'کسر خودکار مواد خام', marks: ['no', 'part', 'yes'] },
          { label: 'محاسبه ضایعات استاندارد', marks: ['no', 'no', 'yes'] },
          { label: 'بهای تمام‌شده لحظه‌ای', marks: ['no', 'part', 'yes'] },
          { label: 'بازنگری فرمول ساخت', marks: ['no', 'no', 'yes'] },
        ],
        interval: 1.0,
      },
      vo: 'وقتی قیمت مواد اولیه نوسان کرد، سیستم فوراً بهای تمام‌شده کالای نهایی را به‌روز می‌کند.',
    },
    ctaScene(7),
  ],
  { noZoom: true },
)

export const reel74: Reel = {
  id: '74',
  title: 'تولید و فرمول ساخت (BOM): قیمت تمام‌شده هر دانه چنده؟',
  duration: total(scenes),
  scenes,
  theme: 'swiss-editorial',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'workshop-producer',
    customerPain: 'بی‌اطلاعی تولیدکننده از بهای تمام‌شده هر عدد کالا و حاشیه سود واقعی',
    oldWorkflow: 'محاسبه سرانگشتی روی تخته کارگاه و فراموش کردن ضایعات و هزینه سربار',
    friction: 'تولید روزبه‌روز بیشتر می‌شود اما سود انتهای ماه با استهلاک و هزینه جور درنمی‌آید',
    hisabcheAction: 'فرمول ساخت چندمرحله‌ای (BOM)، کسر آنی مواد اولیه و ثبت بهای تمام‌شده',
    automatedResult: 'سود و زیان دقیق برای تک‌تک محصولات تولیدی و ثبت اسناد انبار',
    businessOutcome: 'قیمت‌گذاری علمی و افزایش حاشیه سود بدون ریسک ضرر پنهان',
    emotionalPayoff: 'اطمینان مهندسی‌شده از این‌که هر خروجی کارگاه واقعاً سودآور است',
    cta: 'فرمول ساخت در hisabche.com',
    selectedOperators: ['SwissTerminalCurtain', 'BaselineCurtainRise', 'DualBoxCtaHold'],
  },
}
