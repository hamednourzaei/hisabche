// ============================================
// Reel 75: Profit or Loss - Honest Unknown (Scenario 04)
// Funnel stage: Pain / Product Truth | Audience: All business owners
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence([
  {
    dur: 4,
    spec: {
      kind: 'hook',
      label: 'هشدار سود کاغذی',
      lines: ['فروش بالا روی کاغذ،', 'ولی [r:سود واقعی نامعلوم]!'],
      cards: [
        { icon: 'receipt', title: 'فروش روزانه', sub: 'رقم فروش بالا', tone: 'cyan' },
        { icon: 'wallet', title: 'سود واقعی', sub: 'نامعلوم در فاکتور', tone: 'red' },
      ],
    },
    vo: 'فروش بالا روی کاغذ، ولی سود واقعی نامعلوم است.',
  },
  {
    dur: 7,
    spec: {
      kind: 'mockup',
      device: 'window',
      title: 'فاکتور فروش حسابچه با قیمت خرید نامعلوم',
      screen: {
        type: 'invoice',
        header: 'فاکتور شماره ۱۰۴۲',
        items: [
          { name: 'کالای بازرگانی کد ۱۰۱', qty: '۲ عدد', price: '۳٬۲۰۰' },
          { name: 'کالای بدون بهای خرید', qty: '۱ عدد', price: 'نامعلوم' },
        ],
        totalLabel: 'سود برآوردی',
        totalValue: 'نامعلوم',
      },
    },
    vo: 'حسابچه وقتی قیمت خرید را ندارد، نمی‌گوید سود صد درصده؛ صادقانه می‌نویسد نامعلوم.',
  },
  {
    dur: 7,
    spec: {
      kind: 'versus',
      title: 'سود کاغذی در برابر [c:صداقت حسابچه]',
      left: { label: 'سود دروغین سیستم سنتی', value: 'سود فرضی', tone: 'red' },
      right: { label: 'سود واقعی حسابچه', value: 'نامعلوم تا ثبت خرید', tone: 'cyan' },
      verdict: 'حسابچه وقتی نمی‌داند، به تو دروغ نمی‌گوید',
    },
    vo: 'سودت را بشناس، نه فقط رقم فروشت را.',
  },
  {
    dur: 5,
    spec: {
      kind: 'kinetic',
      headline: 'سود واقعی',
      words: ['سود', 'واقعی', 'را', 'بشناس.'],
      tone: 'green',
    },
    vo: 'سود واقعی را بشناس.',
  },
  ctaScene(7),
])

export const reel75: Reel = {
  id: '75',
  title: 'سود کردی یا ضرر؟ کالای بدون قیمت خرید = نامعلوم',
  duration: total(scenes),
  scenes,
  theme: 'kinetic-manifesto',
}
