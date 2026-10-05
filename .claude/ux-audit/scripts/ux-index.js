// Write .claude/ux-audit/README.md from the index the page generator produced,
// and keep the two scripts beside the audit so it can be regenerated.
const fs = require('fs')
const path = require('path')
const OUT = '.claude/ux-audit'
const index = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8'))
const FA = {
  KEEP: 'بماند',
  KEEP_AS_ENTITY: 'بماند (موجودیت)',
  MERGE_AS_TAB: 'تب',
  MERGE_AS_STEP: 'گام/حالت',
  MERGE_AS_PANEL: 'پنل',
  REMOVE_HUB: 'حذف هاب',
  REDIRECT_ONLY: 'redirect به config',
  OUT_OF_SCOPE: 'بیرون از دامنه',
}
const PH = { A: 'الف', B: 'ب', C: 'ج', D: 'د', E: 'ه', F: 'و', G: 'ز' }
const row = (i) =>
  '| `' +
  i.route +
  '` | ' +
  i.title +
  ' | ' +
  FA[i.verdict] +
  ' | ' +
  (i.to ? '`' + i.to + '`' : '—') +
  ' | ' +
  (i.ph && i.ph !== '-' ? PH[i.ph] : '—') +
  ' | ' +
  (i.top ?? '—') +
  ' | [' +
  i.file +
  '](pages/' +
  i.file +
  ') |'
const app = index.filter((i) => i.area === 'app')
const pub = index.filter((i) => i.area === 'public')
const order = [
  'KEEP',
  'KEEP_AS_ENTITY',
  'MERGE_AS_TAB',
  'MERGE_AS_STEP',
  'REMOVE_HUB',
  'REDIRECT_ONLY',
]
app.sort(
  (a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || a.route.localeCompare(b.route),
)

const text = [
  '# بازبینی UX حسابچه — فهرست',
  '',
  '> ۴ اکتبر ۲۰۲۶. هر صفحه‌ی فرانت یک فایل در `pages/` دارد.',
  '> پیشنهاد کلی و فازها: [00-PROPOSAL.md](00-PROPOSAL.md) — **منتظر تأیید**.',
  '> روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.',
  '',
  '## چطور ساخته شد',
  '',
  '1. `scripts/ux-scan.js` همه‌ی `page.tsx`های `apps/web/app` را پیدا می‌کند، کانتینر هر کدام را در',
  '   `packages/ui` دنبال می‌کند و از کد درمی‌آورد: هوک‌های خواندن و نوشتن، تب‌ها، دیالوگ‌ها، لینک‌های',
  '   ورودی و خروجی، عضویت در منو، ماژول دسترسی، route در app-shell، robots و مقاله‌ی راهنما.',
  '2. `scripts/ux-write.js` آن واقعیت‌ها را با قضاوت دستی هر صفحه (کار صفحه، حکم، یافته‌ها) یکی می‌کند',
  '   و فایل‌ها را می‌نویسد.',
  '',
  'برای ساخت دوباره بعد از هر فاز:',
  '',
  '```bash',
  'node .claude/ux-audit/scripts/ux-scan.js .claude/ux-audit/scripts/ux-scan.json',
  '```',
  '',
  '```bash',
  'node .claude/ux-audit/scripts/ux-write.js .claude/ux-audit/scripts/ux-scan.json',
  '```',
  '',
  '```bash',
  'node .claude/ux-audit/scripts/ux-index.js',
  '```',
  '',
  '⚠️ اسکن ایستاست: هیچ صفحه‌ای رندر نشده و هیچ آمار استفاده‌ای در کار نیست. ستون «حالت‌ها» جستجوی',
  'متنی است و باید با دیدن صفحه تأیید شود.',
  '',
  '## شدت یافته‌ها',
  '',
  '`4` کار را متوقف می‌کند یا عدد غلط نشان می‌دهد · `3` کاربر باید صفحه را ترک کند یا بگردد ·',
  '`2` اصطکاک قابل‌توجه · `1` ظاهری · `0` مشکل نیست، نقطه‌ی قوت است.',
  '',
  '## صفحه‌های داخل برنامه — ' + app.length,
  '',
  '| نشانی | صفحه | حکم | مقصد پیشنهادی | فاز | بالاترین شدت | فایل |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...app.map(row),
  '',
  '## صفحه‌های عمومی — ' + pub.length,
  '',
  'بیرون از دامنه‌ی ادغام: سئو، لینک ایمیل یا توکن به نشانی جدا نیاز دارد. فایل هر کدام واقعیت‌های',
  'کد را ثبت کرده است.',
  '',
  '| نشانی | صفحه | فایل |',
  '| --- | --- | --- |',
  ...pub.map(
    (i) => '| `' + i.route + '` | ' + i.title + ' | [' + i.file + '](pages/' + i.file + ') |',
  ),
  '',
].join('\n')
fs.writeFileSync(path.join(OUT, 'README.md'), text)
console.log('index written:', app.length, 'app,', pub.length, 'public')
