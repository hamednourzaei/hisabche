# راهنمای کامل تولید ویدیوی تبلیغاتی حسابچه — از صفر تا MP4

> یک فایل مستقل و قابل دانلود. هر مسیر، دستور، فایل و رفرنس مطابق پروژهٔ واقعی `hisabche-promo-reel` است.
> خواندن این فایل به‌تنهایی برای تولید یک ویدیوی جدید کافی است.

---

## ۰. نقشهٔ پروژه (کجا چه چیزی است)

```
hisabche/                                    ← ریشهٔ مخزن
├── hisabche-promo-reel/                     ← موتور ویدیو (React + Vite + TS)
│   ├── AGENTS.md                            ← دستورالعمل دائمی (نقش، ممنوعیت‌ها، قوانین)
│   ├── PROMO_REEL_WORKFLOW.md               ← ۶ گام + ۶ قانون طلایی + چک‌لیست
│   ├── SCENARIOS.md                         ← ۲۰ سناریو (متن گوینده + زمان‌بندی)
│   ├── SAAS_MOTION_STANDARDS.md             ← استانداردهای موشن SaaS
│   ├── package.json                         ← scripts: dev/build/test/visual-qa/align-vo/export-mp4
│   ├── src/
│   │   ├── reels/                           ← سناریوها (reel-01 … reel-72, reels-*.ts)
│   │   │   ├── index.ts                     ← ثبت REELS
│   │   │   ├── shared.ts                    ← sequence, total, ctaScene, COMPARE_COLUMNS
│   │   │   └── alignments/                  ← reel-XX-alignment.json (زمان کلمات)
│   │   ├── scenes/                          ← کامپوننت‌های بصری (intro, story, system, customer, creative, modern)
│   │   ├── components/                      ← WordDrivenStage.tsx (موتور صحنه)
│   │   ├── templates/                       ← ۲۲ سبک صحنه (kinetic, cinematic, ledger, …)
│   │   ├── ui/                              ← primitiveها (card, typography, motion-primitives)
│   │   ├── engine/                          ← anim, sound, speech-*, story-model, types, guardrails
│   │   ├── data/
│   │   │   ├── reel-registry.ts             ← ثبت تنوع (artDirection, topology, …)
│   │   │   └── template-catalog.ts          ← نگاشت reel → template
│   │   └── __tests__/                       ← guardrails, motion-engine, persian-text, …
│   ├── scripts/
│   │   ├── visual-qa.mjs                    ← اسکرینشات فریم‌های حیاتی (۱۰۸۰×۱۹۲۰)
│   │   ├── align-voiceover.mjs              ← انطباق صدای واقعی گوینده
│   │   ├── export-mp4.mjs                   ← رندر ۷۸۰ فریم + FFmpeg → MP4
│   │   ├── sound-design.mjs                 ← ترک صوتی
│   │   └── check-av-sync.mjs                ← بررسی همگامی صدا/تصویر
│   ├── assets/                              ← لوگو، فونت، تصاویر واقعی
│   ├── audio/                               ← reel-XX-vo.wav (صدای گوینده)
│   ├── docs/prompts/                        ← reel-XX-prompt.md (سند استراتژی)
│   ├── .tmp/visual-qa/                      ← فریم‌های نمونه‌برداری
│   └── exports/  یا  ~/Videos/hisabche-reels/  ← MP4 نهایی
├── docs/                                    ← مخزن اصلی (مایگریشن، audit، …)
└── packages/, apps/, backend/               ← محصول اصلی (بدون تغییر در این کار)
```

---

## ۱. پیش‌نیازها (یک‌بار)

| ابزار      | مسیر/نسخه                                               | کاربرد                   |
| ---------- | ------------------------------------------------------- | ------------------------ |
| Node.js    | `C:\Program Files\nodejs\node.exe`                      | اجرای Vite/TS/اسکریپت‌ها |
| TypeScript | `../node_modules/typescript/bin/tsc`                    | typecheck                |
| Vite       | `../node_modules/vite/bin/vite.js`                      | dev server / build       |
| Vitest     | `../backend/node_modules/vitest/vitest.mjs`             | تست‌ها                   |
| ESLint     | `../node_modules/eslint/bin/eslint.js`                  | lint                     |
| Chrome     | `C:\Program Files\Google\Chrome\Application\chrome.exe` | رندر هدلس (Puppeteer)    |
| FFmpeg     | PATH یا `C:\ffmpeg\bin\ffmpeg.exe`                      | mux H.264/AAC            |
| فونت فارسی | Vazirmatn (در `assets/` یا سیستم)                       | تایپوگرافی فارسی         |

نصب وابستگی‌ها (یک‌بار، از ریشهٔ مخزن):

```bash
pnpm install
```

---

## ۲. هفت قانون طلایی (هیچ‌گاه نقض نشوند)

1. **بدون لوگو در فریم صفر.** شروع با هوک ۳ ثانیه‌ای (ضربهٔ بصری + قلاب کلامی + تکانهٔ صوتی).
2. **بدون «سلام» یا «در این ویدیو…».**
3. **بدون واحد ارزی هاردکد** (افغانی/تومان/دلار/ریال) — فقط `faNumber`.
4. **بدون اسامی سنتی خوراکی** (روغن، برنج، چای، نبات، شکر) — از «کالای بازرگانی کد ۱۰۱» استفاده کن.
5. **تم ۱۰۰٪ تیره** (dark studio) — لایت ممنوع.
6. **بدون خط جداکنندهٔ تزئینی** در پس‌زمینه.
7. **حداکثر ۶ واژهٔ متن غیرزیرنویس** در هر لحظه؛ هر متنی که ظاهر شد تا پایان صحنه می‌ماند.

---

## ۳. شش گام تولید (از ایده تا MP4)

### گام ۱ — سناریو و سند استراتژی

**فایل خروجی:** `docs/prompts/reel-XX-prompt.md`

- سناریوی ۲۶–۶۰ ثانیه‌ای بر اساس فرمول طلایی: قلاب شوک‌آور → تناقض/بحران → علت ساختاری → راهکار حسابچه → CTA.
- تمام جزئیات لحن گوینده، کلمات کلیدی، اکشن‌های مورد انتظار.
- ادعاهای محصول را فقط از جدول «قاعدهٔ ادعاها» در `SCENARIOS.md` بگیر (با کد سنجیده شده).
- **ستون مقایسه همیشه سه‌تایی است:** اکسل و دفتر · نرم‌افزار سنتی · حسابچه.

### گام ۲ — مانیفست هماهنگی کلمات

**فایل خروجی:** `src/reels/alignments/reel-XX-alignment.json`

- زمان دقیق شروع/پایان هر کلمه + `action` متناظر.
- از `cadence-model.ts` یا ساختار JSON استفاده کن.

### گام ۳ — کدنویسی صحنه‌ها

**فایل خروجی:** `src/reels/reel-XX-<slug>.ts`

1. صحنه‌ها با `kind: 'word-sync'` در فایل اختصاصی رجیستر می‌شوند.
2. اکترهای بصری در `src/components/WordDrivenStage.tsx`.
3. استایل‌ها در `src/styles.css`.
4. از `sequence([...])` و `ctaScene(dur)` در `shared.ts` استفاده کن.
5. **ضد تکرار:** هر ویدیو ترکیبی متمایز از ۲۲ سبک صحنه (`kinetic-manifesto`, `cinematic-product`, `ledger`, `chart`, …).
6. تم ۱۰۰٪ تیره از پالت‌های: `obsidian-cinematic`, `dark-neon`, `midnight-gold`, `financial-intelligence`, `procedural-spatial`, `swiss-editorial`.

**ثبت در registry:**

- `src/reels/index.ts` → `import { reelXX } from './reel-XX-...'` + افزودن به `REELS`.
- `src/data/reel-registry.ts` → افزودن ورودی (artDirection, layoutTopology, operators, themeName, …). باید با ۳ ویدیوی قبلی از نظر topology و artDirection متفاوت باشد.

### گام ۴ — تست و اعتبارسنجی بصری خودکار

```bash
node scripts/visual-qa.mjs <ID>
```

- فریم‌های حیاتی در `.tmp/visual-qa/reel-XX/` ذخیره می‌شوند (۱۰۸۰×۱۹۲۰).
- بررسی: پر بودن یک‌سوم بالا، عدم وجود اعداد منفی، تمیزی زیرنویس.
- **تست‌های خودکار:**
  ```bash
  npm run typecheck          # 0 خطا
  npm test                   # 100% سبز
  npm run build              # موفق
  ```

### گام ۵ — انطباق صوت واقعی گوینده

1. فایل صدای گوینده را در `audio/reel-XX-vo.wav` قرار بده.
2. اجرا:
   ```bash
   node scripts/align-voiceover.mjs <ID>
   ```

### گام ۶ — اکسپورت نهایی MP4

```bash
node scripts/export-mp4.mjs <ID>
```

- سرور Vite داخلی راه‌اندازی می‌شود.
- Chrome headless ۷۸۰ فریم (برای ۲۶s) شکار می‌کند.
- ترک صوتی ساخته می‌شود.
- FFmpeg خروجی H.264 + AAC در `~/Videos/hisabche-reels/reel-XX.mp4` (یا `exports/`).

---

## ۴. ساختار یک ریل (الگوی کد)

```ts
// src/reels/reel-XX-<slug>.ts
import type { Reel } from '../engine/types'
import { COMPARE_COLUMNS, ctaScene, sequence, total } from './shared'

const scenes = sequence([
  { dur: 4,  spec: { kind: 'hook',    label: '...', lines: [...], cards: [...] }, vo: '...' },
  { dur: 5,  spec: { kind: 'branch',  cards: [...], question: '...', answer: '...', badge: '...' }, vo: '...' },
  { dur: 7,  spec: { kind: 'stagger', title: '...', header: [...], rows: [...], interval: 0.8, tone: 'cyan' }, vo: '...' },
  { dur: 8,  spec: { kind: 'hub',     title: '...', core: '...', coreSub: '...', nodes: [...] }, vo: '...' },
  { dur: 10, spec: { kind: 'compare', title: '...', columns: COMPARE_COLUMNS, rows: [...], interval: 1.1 }, vo: '...' },
  { dur: 9,  spec: { kind: 'bridge',  title: '...', left: {...}, right: {...}, merged: '...', caption: '...', summaries: [...] }, vo: '...' },
  ctaScene(15),
])

export const reelXX: Reel = {
  id: 'XX',
  title: 'عنوان فارسی',
  duration: total(scenes),   // باید ۵۹ باشد (یا ۴۵–۶۰)
  scenes,
  theme: 'financial-intelligence',   // تم تیره
}
```

**ساختار یک صحنه (Scene):**

- `start`, `end` (ثانیه) — خودکار توسط `sequence`.
- `spec.kind` — یکی از ۲۲ سبک (`hook`, `branch`, `stagger`, `hub`, `compare`, `bridge`, `cta`, `kinetic-manifesto`, …).
- `vo` — متن گوینده (فارسی).
- `spec.lines` — متن روی صحنه (حداکثر ۶ واژه، بدون تکرار vo).
- `spec.cards` / `rows` / `nodes` — داده‌های بصری.

---

## ۵. رفرنس‌های واقعی (فقط این‌ها را استفاده کن)

| نوع          | مسیر                                   | نکته                         |
| ------------ | -------------------------------------- | ---------------------------- |
| لوگو         | `assets/logo*.svg/png`                 | فقط فایل واقعی؛ redraw ممنوع |
| فونت فارسی   | Vazirmatn (assets یا سیستم)            | ۷۰۰/۵۰۰/۴۰۰                  |
| فونت اعداد   | Studio Odometer                        | tabular nums                 |
| آیکون‌ها     | `src/ui/icons.tsx`                     | primitive، redraw ممنوع      |
| تصاویر محصول | `assets/screenshots/`                  | اسکرین‌شات واقعی اپ          |
| صدای گوینده  | `audio/reel-XX-vo.wav`                 | فایل واقعی                   |
| پالت         | hex codes در brief                     | بدون رنگ خارج از پالت        |
| سناریو       | `SCENARIOS.md`                         | ۲۰ سناریو با متن گوینده      |
| ادعاها       | جدول «قاعدهٔ ادعاها» در `SCENARIOS.md` | با کد سنجیده شده             |

---

## ۶. چک‌لیست اعتبارسنجی (Definition of Done)

قبل از اعلام اتمام کار، همهٔ این‌ها باید سبز باشند:

- [ ] `npm run typecheck` → ۰ خطا
- [ ] `npm test` → ۱۰۰٪ سبز
- [ ] `npm run build` → موفق
- [ ] `npm run visual-qa <ID>` → فریم‌ها در `.tmp/visual-qa/reel-XX/`
- [ ] فریم‌ها فاقد لیبل متادیتا در زیرنویس
- [ ] تایمرها مثبت و بدون علامت منفی
- [ ] یک‌سوم بالای صحنه دارای تیتر/هدر برند
- [ ] `exports/reel-XX.mp4` (یا `~/Videos/hisabche-reels/`) بدون نقص و قابل پخش
- [ ] `node scripts/check-av-sync.mjs` → ۰ خطای همگامی

---

## ۷. حلقهٔ کیفیت (۲۰ فریم → نقد → ۳ اصلاح → re-render)

1. **نمونه‌برداری:** از `.tmp/visual-qa/reel-XX/` یا با استخراج ۲۰ فریم یکنواخت از MP4:
   ```bash
   ffmpeg -i reel-XX.mp4 -vf "select='not(mod(n\,90))'" -vsync vfr frame_%03d.png
   ```
2. **نقد شدید:** بررسی تایپوگرافی، کنتراست، فضای خالی، همگامی، overflow، خوانایی فارسی.
3. **۳ ضعف بزرگ:** شناسایی و اولویت‌بندی.
4. **اصلاح:** ویرایش `src/reels/reel-XX-*.ts` یا `src/styles.css`.
5. **re-render:** `npm run visual-qa <ID>` → دوباره نمونه‌برداری.
6. **تکرار** تا همهٔ امتیازها ≥ ۸/۱۰.

---

## ۸. دستورات سریع (Cheat Sheet)

```bash
cd hisabche-promo-reel

# typecheck
node ../node_modules/typescript/bin/tsc --noEmit -p .

# test
node ../backend/node_modules/vitest/vitest.mjs run

# build
node ../node_modules/vite/bin/vite.js build

# lint
node ../node_modules/eslint/bin/eslint.js src/

# visual qa (فریم‌های حیاتی)
node scripts/visual-qa.mjs <ID>

# align voiceover
node scripts/align-voiceover.mjs <ID>

# export MP4
node scripts/export-mp4.mjs <ID>

# av sync check
node scripts/check-av-sync.mjs <ID>
```

---

## ۹. ممنوعیت‌های صریح (Strict Bans)

1. هرگز ویدیو با لود لوگوی حسابچه شروع نشود.
2. هرگز با «سلام» یا «در این ویدیو می‌خواهیم…» شروع نشود.
3. هرگز از ادبیات نامفهوم/اصطلاحات خشک اداری در ۳ ثانیهٔ اول.
4. حذف مطلق واحدهای ارزی هاردکد (افغانی، تومان، دلار، ریال).
5. عمومی‌سازی اقلام (B2B Generic): بدون روغن/برنج/چای/نبات/شکر.
6. تم ۱۰۰٪ تیره — لایت ممنوع.
7. تایمینگ ریاضی بی‌نقص: مجموع ثانیه‌ها باید دقیقاً منطبق با تست‌ها (۵۹s).

---

## ۱۰. فایل‌های کلیدی برای مطالعه

| فایل                                    | چرا                                              |
| --------------------------------------- | ------------------------------------------------ |
| `AGENTS.md`                             | دستورالعمل دائمی (نقش، ممنوعیت‌ها، قوانین ۱۴–۱۹) |
| `PROMO_REEL_WORKFLOW.md`                | ۶ گام + ۶ قانون طلایی + چک‌لیست                  |
| `SCENARIOS.md`                          | ۲۰ سناریو + قاعدهٔ ادعاها                        |
| `SAAS_MOTION_STANDARDS.md`              | استانداردهای موشن SaaS                           |
| `src/reels/reel-01-cloud-or-desktop.ts` | الگوی یک ریل کامل (۵۸s)                          |
| `src/reels/shared.ts`                   | helperهای sequence/total/ctaScene                |
| `src/components/WordDrivenStage.tsx`    | موتور صحنه                                       |
| `src/data/reel-registry.ts`             | ثبت تنوع                                         |
| `src/data/template-catalog.ts`          | نگاشت reel → template                            |
| `src/engine/guardrails.ts`              | BANNED_PERSIAN_FRAGMENTS, MAX_ONSTAGE_WORDS      |
| `src/engine/sound.ts`                   | کتابخانهٔ صدا                                    |
| `src/engine/speech-model.ts`            | forced-alignment                                 |
| `scripts/export-mp4.mjs`                | رندر + FFmpeg                                    |
| `scripts/visual-qa.mjs`                 | اسکرینشات فریم‌های حیاتی                         |

---

> **نکتهٔ نهایی:** این سند یک workflow زنده است. هر بار که یک ریل جدید تولید می‌شود، `docs/prompts/reel-XX-prompt.md` را به‌عنوان سند استراتژی ثبت کنید و چک‌لیست §۶ را تیک بزنید.
