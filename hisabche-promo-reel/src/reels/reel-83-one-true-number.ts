// ============================================
// Reel 83 — «یک عدد واقعی» (the flagship cut)
//
// One shop, one day, one question the owner cannot answer from memory: how
// much is really left? The film answers it the way the product does — a
// customer conversation, the invoice, the stock, the books, the profit — and
// each beat hands the frame to a different kind of motion instead of repeating
// the same card layout.
//
// Every figure below is the same arithmetic seen from a different angle:
//   ۴۲٬۰۰۰ فروش − ۳۱٬۰۰۰ پرداخت = ۱۱٬۰۰۰ ماندهٔ مشتری
//   ۴۲۰٬۰۰۰ فروش − ۲۶۰٬۰۰۰ بهای تمام‌شده − ۷۰٬۰۰۰ هزینه = ۹۰٬۰۰۰ سود
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence([
  // 1 — frame-0 arrest: two systems, two numbers, one shop.
  {
    dur: 5,
    spec: {
      kind: 'hook',
      theme: 'obsidian-cinematic',
      openingArchetype: 'immediate-consequence',
      label: 'دو عدد برای یک مغازه',
      lines: ['دخل می‌گوید ۴۲٬۰۰۰', 'دفتر می‌گوید ۳۱٬۰۰۰', '[r:کدام درست است؟]'],
      consequence: {
        alertBanner: 'مغایرت صندوق و دفتر: ۲۶٪',
        stoppedAction: 'فاکتور زدن متوقف شد؛ مشتری پای صندوق منتظر است',
        lossMetric: 'اعتماد مشتری در حال آب رفتن',
      },
    },
    vo: 'دخل یک عدد می‌گوید، دفتر یک عدد دیگر. کدام درست است؟',
  },

  // 2 — the question that starts every real transaction, asked by a character.
  {
    dur: 9,
    spec: {
      kind: 'dialogue',
      theme: 'obsidian-cinematic',
      title: 'همان سؤال، پای صندوق',
      turns: [
        { speaker: 'customer', text: 'این ماه چقدر خرید کردم؟' },
        { speaker: 'owner', text: 'الان از حسابچه می‌بینم…' },
        { speaker: 'owner', text: '۴۲٬۰۰۰ خرید، ۳۱٬۰۰۰ پرداخت.' },
        { speaker: 'customer', text: 'پس ۱۱٬۰۰۰ مانده.' },
      ],
    },
    vo: 'مشتری می‌پرسد این ماه چقدر خرید کرده؛ مالک از حسابچه جواب می‌دهد.',
  },

  // 3 — the mess the product replaces, converging into one surface.
  {
    dur: 6,
    spec: {
      kind: 'fragmented-tools-demo',
      theme: 'procedural-spatial',
      title: 'اکسل، دفتر، ماشین‌حساب — سه نسخه از یک واقعیت',
      convergeAt: 2.6,
    },
    vo: 'اکسل، دفتر و ماشین‌حساب هر کدام یک نسخه از واقعیت می‌سازند.',
  },

  // 4 — the proof: issuing the invoice moves four other things at once.
  {
    dur: 7,
    spec: {
      kind: 'mockup',
      theme: 'financial-intelligence',
      device: 'window',
      title: 'یک فاکتور، [c:پنج ثبت هم‌زمان]',
      subtitle: 'موجودی، دفتر، صندوق و طلب مشتری با همان یک کلیک',
      screen: {
        type: 'invoice',
        header: 'فاکتور ۱۰۴۲ — مشتری ۱۰۴۲',
        items: [
          { name: 'کالای بازرگانی کد ۱۰۱', qty: '۲ عدد', price: '۲۴٬۰۰۰' },
          { name: 'کالای مصرفی کد ۳۰۳', qty: '۱ عدد', price: '۱۸٬۰۰۰' },
        ],
        totalLabel: 'مبلغ فاکتور',
        totalValue: '۴۲٬۰۰۰',
      },
      toast: { icon: 'check', text: 'انبار کسر شد · سند دفتر خورد · طلب ثبت شد', time: 2.4 },
    },
    vo: 'با صدور فاکتور، موجودی کم می‌شود، سند دفتر می‌خورد و طلب مشتری ثبت می‌شود.',
  },

  // 5 — where the money actually went, waterfall with no invented number.
  {
    dur: 6,
    spec: {
      kind: 'profit-waterfall-demo',
      theme: 'financial-intelligence',
      title: 'از فروش تا [g:سود واقعی]',
      grossRevenue: 420000,
      cogs: 260000,
      expenses: 70000,
    },
    vo: 'فروش چهارصد و بیست هزار، بهای تمام‌شده دویست و شصت هزار، هزینه هفتاد هزار؛ سود نود هزار.',
  },

  // 6 — the same invoice, now seen in space: stock moved, no ledger gap.
  {
    dur: 5,
    spec: {
      kind: 'warehouse-movement-demo',
      theme: 'cyber-emerald',
      title: 'همان فاکتور، انبار را هم تکان داد',
      transitAt: 1.6,
      arriveAt: 3.2,
    },
    vo: 'همان فاکتور، موجودی انبار مبدا و مقصد را با هم به‌روز می‌کند.',
  },

  // 7 — breadth: every part of the business already lit in one frame.
  {
    dur: 6,
    spec: {
      kind: 'hub',
      theme: 'midnight-gold',
      title: 'همه در [p:یک هسته]',
      core: 'حسابچه',
      coreSub: 'یک نسخه از واقعیت',
      nodes: [
        { icon: 'receipt', label: 'فروش' },
        { icon: 'boxes', label: 'انبار' },
        { icon: 'book', label: 'دفتر' },
        { icon: 'bank', label: 'بانک' },
        { icon: 'factory', label: 'تولید' },
      ],
    },
    vo: 'فروش، انبار، دفتر، بانک و تولید روی یک هسته می‌نشینند.',
  },

  // 8 — the customer statement, the number the owner can finally say out loud.
  {
    dur: 7,
    spec: {
      kind: 'ledger',
      theme: 'midnight-gold',
      title: 'ماندهٔ مشتری ۱۰۴۲',
      name: 'مشتری ۱۰۴۲',
      lines: [
        { label: 'خرید این ماه', amount: '۴۲٬۰۰۰' },
        { label: 'پرداخت‌ها', amount: '۳۱٬۰۰۰' },
      ],
      balanceFrom: 0,
      balanceTo: 11000,
      unit: '',
      footer: 'همان عددی که پای صندوق گفته شد',
    },
    vo: 'ماندهٔ مشتری یازده هزار است؛ همان عددی که پای صندوق گفته شد.',
  },

  // 9 — thesis in typography, not in a card.
  {
    dur: 5,
    spec: {
      kind: 'kinetic-manifesto',
      theme: 'kinetic-manifesto',
      headline: ['یک عدد.', 'واقعی.'],
      subheadline: 'نه حدس، نه دفتر دوم',
      statements: [
        'فروش و انبار با هم می‌خوانند',
        'سود از بهای واقعی می‌آید',
        'هر عدد، قابل ردیابی است',
      ],
      accentTone: 'green',
    },
    vo: 'یک عدد واقعی؛ نه حدس، نه دفتر دوم.',
  },

  ctaScene(9),
])

export const reel83: Reel = {
  id: '83',
  title: 'یک عدد واقعی — چرخه کامل فروش، انبار، دفتر و سود',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  musicMood: 'uplifting',
}
