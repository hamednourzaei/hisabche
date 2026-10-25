// ============================================
// Reel 82 — «گفتگوی مشتری و مالک» (two characters, one counter)
//
// The whole film happens across a counter: a customer asks a question she has
// every right to ask, and the shopkeeper answers out of the product instead of
// out of a notebook. Two animated characters carry the reel; every number on
// screen is a number Hisabche actually holds.
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence([
  {
    dur: 5,
    spec: {
      kind: 'hook',
      theme: 'obsidian-cinematic',
      label: 'پای صندوق، ساعت شلوغی',
      lines: ['مشتری: «چقدر بدهکارم؟»', '[r:مالک: «بگذار دفتر را ببینم…»]'],
      cards: [
        { icon: 'user', title: 'مشتری', sub: 'پیگیری نسیه', tone: 'cyan' },
        { icon: 'store', title: 'مالک', sub: 'دفتر و ماشین‌حساب', tone: 'red' },
      ],
    },
    vo: 'مشتری می‌پرسد چقدر بدهکار است. مالک باید دفتر را ببیند.',
  },
  {
    dur: 9,
    spec: {
      kind: 'dialogue',
      theme: 'obsidian-cinematic',
      title: 'پاسخ در لحظه',
      turns: [
        { speaker: 'customer', text: 'حساب نسیهٔ من چقدر مانده؟' },
        { speaker: 'owner', text: 'یک لحظه…' },
        { speaker: 'owner', text: '۱۲٬۴۰۰٬۰۰۰ مانده.' },
      ],
    },
    vo: 'مشتری می‌پرسد حساب نسیه‌اش چقدر مانده. مالک با حسابچه در لحظه جواب می‌دهد.',
  },
  {
    dur: 7,
    spec: {
      kind: 'versus',
      theme: 'procedural-spatial',
      title: 'دفتر کاغذی یا [c:حساب زنده]',
      left: { label: 'بدون حسابچه', value: 'جستجو در دفتر', tone: 'red' },
      right: { label: 'با حسابچه', value: 'پاسخ در ۳ ثانیه', tone: 'cyan' },
      verdict: 'پاسخ سریع، اعتماد می‌سازد',
    },
    vo: 'بدون حسابچه جستجو در دفتر؛ با حسابچه پاسخ در سه ثانیه.',
  },
  {
    dur: 8,
    spec: {
      kind: 'dialogue',
      theme: 'obsidian-cinematic',
      title: 'سابقهٔ خرید',
      turns: [
        { speaker: 'customer', text: 'فاکتور قبلی‌ام کی بود؟' },
        { speaker: 'owner', text: 'فاکتور ۱۰۴۲، سه روز پیش.' },
        { speaker: 'customer', text: 'همین را می‌خواستم.' },
      ],
    },
    vo: 'مشتری سابقهٔ فاکتور را می‌پرسد و مالک همان لحظه نشان می‌دهد.',
  },
  {
    dur: 8,
    spec: {
      kind: 'ledger',
      theme: 'midnight-gold',
      title: 'صورت‌حساب مشتری',
      name: 'مشتری ۱۰۴۲',
      lines: [
        { label: 'خرید', amount: '۴۲٬۰۰۰' },
        { label: 'پرداخت', amount: '۳۱٬۰۰۰' },
      ],
      balanceFrom: 0,
      balanceTo: 11000,
      unit: '',
      footer: 'ماندهٔ نهایی، بدون حدس',
    },
    vo: 'خرید چهل‌ودو هزار، پرداخت سی‌ویک هزار، مانده یازده هزار.',
  },
  {
    dur: 4,
    spec: {
      kind: 'kinetic',
      theme: 'kinetic-manifesto',
      headline: 'پاسخ در لحظه',
      words: ['پاسخ', 'در', 'لحظه،', 'اعتماد', 'می‌سازد.'],
      tone: 'cyan',
    },
    vo: 'پاسخ در لحظه، اعتماد می‌سازد.',
  },
  ctaScene(8),
])

export const reel82: Reel = {
  id: '82',
  title: 'گفتگوی مشتری و مالک — پاسخ حسابچه در لحظه',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  musicMood: 'uplifting',
}
