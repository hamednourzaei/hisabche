# پرامپت کامل Refactor — تبدیل Promo Reel Workflow به Creative Intelligence Engine

> این فایل یک **پرامپت اجرایی برای Claude Code / Codex / هر agent** است.
> هدف: بدون خراب‌کردن engine موجود (Remotion + forced alignment + guardrails)، یک لایهٔ **Creative Intelligence** قبل از `src/reels/reel-XX.ts` اضافه کنیم.
> خروجی: یک سیستم که قبل از تولید هر Reel، خودش تصمیم بگیرد «این ویدیو چگونه باید متفاوت باشد» و اگر شبیه قبلی‌ها بود، reject کند.

---

## 0. قانون مطلق (پیش از هر چیز)

**هیچ‌کدام از فایل‌های engine موجود را حذف نکن.** `WordDrivenStage.tsx`, `engine/sound.ts`, `engine/speech-*.ts`, `engine/guardrails.ts`, `scripts/export-mp4.mjs`, `scripts/visual-qa.mjs` باید بدون تغییر کار کنند. فقط یک لایهٔ جدید **قبل** از آن‌ها اضافه می‌شود و یک **gate** در build/test برای تنوع اضافه می‌شود.

---

## 1. ساختار جدید (فایل‌های جدید)

```
hisabche-promo-reel/src/
├── creative/                                  ← لایهٔ جدید (Creative Intelligence)
│   ├── types.ts                               ← CreativeDNA schema
│   ├── creative-dna.ts                        ← تعریف 15 محور Creative DNA
│   ├── trend-research.ts                      ← interface به TikTok Creative Center / منابع trend
│   ├── reference-analyzer.ts                  ← تحلیل یک Reel مرجع → Creative DNA
│   ├── creative-director.ts                   ← تولید 3 concept radically different
│   ├── novelty-score.ts                       ← محاسبهٔ شباهت با N ریل قبلی
│   ├── creative-qa.ts                         ← 3 سوال تازگی + reject
│   └── index.ts
├── data/
│   ├── creative-moments.ts                    ← بانک 30–50 لحظهٔ خلاقانه
│   └── narrative-grammars.ts                  ← 4+ الگوی روایی (A/B/C/D/...)
├── reels/
│   └── reel-XX-*.ts                           ← باید CreativeDNA را export کنند
├── __tests__/
│   ├── creative-novelty.test.ts               ← تست شباهت
│   └── creative-qa.test.ts
scripts/
├── variety-check.mjs                          ← gate در build
└── creative-brief.mjs                         ← تولید 3 concept از یک ایده
docs/prompts/
└── reel-XX-prompt.md                          ← باید «تفاوت اصلی با 3 ریل قبلی» را داشته باشد
```

---

## 2. Creative DNA Schema (`src/creative/types.ts`)

```ts
export type NarrativeGrammar =
  | 'classic' // Hook → Problem → Cause → Solution → CTA
  | 'inverted' // Outcome → Why → Comparison → Hook → CTA
  | 'story' // Character → Crisis → Discovery → Solution → CTA
  | 'interrogative' // Question → Question → Question → Answer → CTA
  | 'pov' // POV first-person, no narrator
  | 'documentary' // Fake doc, timestamps, voiceover
  | 'comedy' // Setup → tension → silence → punchline
  | 'pure-ui' // Only product, cursor, data
  | 'cinematic' // Visual metaphor, no cards

export type HookMechanism =
  | 'visual-shock'
  | 'contrarian'
  | 'specific-metric'
  | 'micro-disaster'
  | 'profit-leak'
  | 'role-paradox'
  | 'stop-doing-this'
  | 'binary-dilemma'

export type VisualMedium =
  | 'dark-studio-3d'
  | 'screen-recording'
  | 'ugc-facecam'
  | 'illustration'
  | 'typography-only'
  | 'documentary'
  | 'product-only'
  | 'mixed'

export type CameraLanguage =
  'static' | 'slow-drift' | 'kinetic-zoom' | 'handheld' | 'orbit' | 'none'

export type EditingRhythm = 'slow-build' | 'rapid-cuts' | 'single-take' | 'staccato' | 'breathing'

export type SoundLanguage =
  'cinematic' | 'tactile-foley' | 'minimal' | 'rhythmic-urgency' | 'silence-heavy'

export type RealityLevel = 'abstract' | 'semi-real' | 'real-product' | 'real-people'

export type HumorLevel = 0 | 1 | 2 | 3

export type TensionLevel = 0 | 1 | 2 | 3

export type CreativeDNA = {
  reelId: string
  narrativeGrammar: NarrativeGrammar
  hookMechanism: HookMechanism
  visualMedium: VisualMedium
  cameraLanguage: CameraLanguage
  editingRhythm: EditingRhythm
  soundLanguage: SoundLanguage
  realityLevel: RealityLevel
  humorLevel: HumorLevel
  tensionLevel: TensionLevel
  productExposure: 'none' | 'light' | 'heavy'
  humanPresence: 'none' | 'voice' | 'face' | 'character'
  surpriseMechanism: string // یک جمله: چه چیز غیرمنتظره اتفاق می‌افتد
  emotionalArc: string // مثلاً "curiosity → dread → relief"
  creativeMoments: string[] // حداقل 2 id از creative-moments.ts
  noveltyClaim: string // «تفاوت اصلی با 3 ریل قبلی چیست؟»
  // metadata
  artDirection: string
  layoutTopology: string
  themeName: string
}
```

---

## 3. Novelty Score (`src/creative/novelty-score.ts`)

```ts
export type NoveltyResult = {
  score: number // 0..1 (1 = کاملاً متفاوت)
  passed: boolean // score >= 0.6
  reasons: string[] // کدام محورها تکراری بودند
  comparedWith: string[] // idهای ریل‌های مقایسه شده
}

export function computeNovelty(
  candidate: CreativeDNA,
  previous: CreativeDNA[],
  windowSize = 20,
): NoveltyResult
```

**قانون:** حداقل 2 محور از `{narrativeGrammar, hookMechanism, visualMedium, cameraLanguage, editingRhythm, soundLanguage}` باید با هر ریل در پنجرهٔ 20تایی متفاوت باشد. در غیر این صورت `passed = false` و build fail.

**وزن‌ها:** narrativeGrammar (0.25), hookMechanism (0.2), visualMedium (0.15), cameraLanguage (0.1), editingRhythm (0.1), soundLanguage (0.1), surpriseMechanism (0.1).

---

## 4. Creative Moments Bank (`src/data/creative-moments.ts`)

```ts
export type CreativeMoment = {
  id: string
  name: string
  description: string
  category: 'visual' | 'narrative' | 'audio' | 'typography' | 'interaction'
}

export const CREATIVE_MOMENTS: CreativeMoment[] = [
  { id: 'number-shatters', name: 'عدد بزرگ که می‌شکند', ... },
  { id: 'two-screens-merge', name: 'دو صفحه که به هم می‌چسبند', ... },
  { id: 'light-from-point', name: 'نور از یک نقطه شروع می‌شود', ... },
  { id: 'text-slides-rtl', name: 'متن که از راست به چپ می‌لغزد', ... },
  // ... حداقل 30 مورد
]

export function validateCreativeMoments(moments: string[], previousMoments: string[][]): boolean
// true اگر حداقل 2 مورد در candidate جدید و در هیچ کدام از 3 ریل قبلی نبوده
```

---

## 5. Narrative Grammars (`src/data/narrative-grammars.ts`)

```ts
export type NarrativeGrammarDef = {
  id: NarrativeGrammar
  name: string
  description: string
  sceneOrder: string[]   // مثلاً ['hook','crisis','cause','solution','cta']
  example: string
}

export const NARRATIVE_GRAMMARS: NarrativeGrammarDef[] = [
  { id: 'classic', name: 'کلاسیک', sceneOrder: ['hook','problem','cause','solution','compare','cta'], ... },
  { id: 'inverted', name: 'معکوس', sceneOrder: ['outcome','why','comparison','hook','cta'], ... },
  { id: 'story', name: 'داستانی', sceneOrder: ['character','crisis','discovery','solution','cta'], ... },
  { id: 'interrogative', name: 'پرسشی', sceneOrder: ['question','question','question','answer','cta'], ... },
  { id: 'pov', name: 'POV', sceneOrder: ['pov-hook','tension','reveal','product','cta'], ... },
  { id: 'documentary', name: 'مستند', sceneOrder: ['timestamp','event','voiceover','product','cta'], ... },
  { id: 'comedy', name: 'کمدی', sceneOrder: ['setup','tension','silence','punchline','cta'], ... },
  { id: 'pure-ui', name: 'UI خالص', sceneOrder: ['hook','screen-recording','data-change','outcome','cta'], ... },
  { id: 'cinematic', name: 'سینمایی', sceneOrder: ['visual-metaphor','tension','reveal','product','cta'], ... },
]
```

**قانون:** دو ریل پشت‌سرهم نباید یک `narrativeGrammar` داشته باشند.

---

## 6. Creative Director (`src/creative/creative-director.ts`)

```ts
export type CreativeConcept = {
  id: string
  title: string
  dna: CreativeDNA
  rationale: string // چرا این concept متفاوت است
}

export function generateConcepts(
  idea: string,
  previousDNAs: CreativeDNA[],
  count = 3,
): CreativeConcept[]
```

**رفتار:**

1. ایدهٔ کاربر را بگیر.
2. 3 concept **radically different** تولید کن (نه 3 variation از یک ایده).
3. هر concept باید حداقل 2 محور Creative DNA با قبلی‌ها متفاوت باشد.
4. خروجی: 3 concept + دلیل + Novelty Score هر کدام.
5. اگر هیچ conceptی Novelty >= 0.6 نداشت → خطا (ایدهٔ کاربر خیلی محدود است).

---

## 7. Trend Research Interface (`src/creative/trend-research.ts`)

```ts
export type TrendSignal = {
  source: 'tiktok-creative-center' | 'meta-ad-library' | 'youtube-trending' | 'manual'
  hookPattern: string
  visualPattern: string
  audioPattern: string
  engagement: number // 0..1
  capturedAt: string // ISO date
}

export function fetchTrendSignals(category: string): Promise<TrendSignal[]>
export function getTopHookPatterns(n = 10): string[]
```

**فاز ۱ (MVP):** فقط `manual` source — یک فایل JSON `data/trend-signals.json` که دستی یا هفتگی پر می‌شود.
**فاز ۲:** اتصال به TikTok Creative Center API (در صورت دسترسی).

---

## 8. Reference Analyzer (`src/creative/reference-analyzer.ts`)

```ts
export function analyzeReferenceReel(videoPath: string): Promise<CreativeDNA>
```

**ورودی:** مسیر یک ویدیوی مرجع (مثلاً یک Reel وایرال).
**خروجی:** Creative DNA استخراج شده (hook mechanism, visual medium, camera language, editing rhythm, sound language, ...).
**پیاده‌سازی MVP:** تحلیل دستی (فرم) + ذخیره در `data/reference-dnas.json`. فاز ۲: Vision model.

---

## 9. Creative QA (`src/creative/creative-qa.ts`)

```ts
export type CreativeQAResult = {
  passed: boolean
  scores: {
    hookSurprise: number // 0..10: آیا 3 ثانیه اول غافلگیرکننده است؟
    noveltyMoment: number // 0..10: آیا حداقل یک لحظه «اوه، این جالبه» هست؟
    endingDifference: number // 0..10: آیا پایان‌بندی با قبلی متفاوت است؟
  }
  reasons: string[]
}

export function runCreativeQA(
  candidate: CreativeDNA,
  previous: CreativeDNA[],
  frames: string[], // مسیرهای فریم‌های نمونه
): CreativeQAResult
```

**قانون:** اگر هر کدام از 3 امتیاز < 7 → `passed = false` → بازنویسی اجباری.

**فاز ۱ (MVP):** heuristic (بررسی Creative DNA: آیا surpriseMechanism تعریف شده؟ آیا creativeMoments جدید هستند؟ آیا narrativeGrammar متفاوت است؟).
**فاز ۲:** Vision model روی فریم‌ها.

---

## 10. variety-check.mjs (gate در build)

```js
// scripts/variety-check.mjs
// اجرا: node scripts/variety-check.mjs
// خروجی: exit code 0 (pass) یا 1 (fail)

const fs = require('fs')
const path = require('path')

// 1. خواندن همهٔ reel-XX-*.ts از src/reels/
// 2. استخراج CreativeDNA از هر فایل (regex یا import)
// 3. برای هر ریل، بررسی با 20 ریل قبلی:
//    - حداقل 2 محور از {narrativeGrammar, hookMechanism, visualMedium, cameraLanguage, editingRhythm, soundLanguage} متفاوت
//    - حداقل 2 creativeMoment جدید (نبوده در 3 ریل قبلی)
//    - narrativeGrammar ≠ narrativeGrammar 3 ریل قبلی
// 4. اگر هر کدام fail → exit 1 + گزارش دقیق
```

**اتصال به build:** در `package.json`:

```json
"build": "node scripts/variety-check.mjs && node ../node_modules/typescript/bin/tsc --noEmit -p . && node ../node_modules/vite/bin/vite.js build"
```

---

## 11. creative-brief.mjs (تولید 3 concept)

```js
// scripts/creative-brief.mjs <idea>
// خروجی: 3 concept با CreativeDNA + Novelty Score + دلیل
// مثال: node scripts/creative-brief.mjs "فاکتور اشتباه 30 ثانیه هزینه 2 ماه"
```

**رفتار:**

1. ایدهٔ کاربر را بگیر.
2. 3 concept radically different تولید کن.
3. هر concept را با 20 ریل قبلی مقایسه کن (Novelty Score).
4. خروجی: جدول 3 concept با scores + دلیل + توصیه (کدام را بسازیم).

---

## 12. تغییرات در فایل‌های موجود

### 12.1 `src/reels/reel-XX-*.ts`

هر ریل باید یک `export const reelXXDNA: CreativeDNA` داشته باشد:

```ts
export const reel72DNA: CreativeDNA = {
  reelId: '72',
  narrativeGrammar: 'pov',
  hookMechanism: 'micro-disaster',
  visualMedium: 'screen-recording',
  cameraLanguage: 'handheld',
  editingRhythm: 'rapid-cuts',
  soundLanguage: 'minimal',
  realityLevel: 'real-product',
  humorLevel: 1,
  tensionLevel: 2,
  productExposure: 'heavy',
  humanPresence: 'voice',
  surpriseMechanism: 'فاکتور اشتباه 30 ثانیه → 2 ماه هزینه',
  emotionalArc: 'curiosity → dread → relief',
  creativeMoments: ['number-shatters', 'text-slides-rtl'],
  noveltyClaim: 'اولین ریل با screen-recording خالص و POV بدون کارت UI',
  artDirection: 'financial-intelligence',
  layoutTopology: 'full-bleed-kinetic',
  themeName: 'financial-intelligence',
}
```

### 12.2 `src/data/reel-registry.ts`

افزودن فیلد `creativeDNA: CreativeDNA` به `ReelRegistryEntry` (optional در فاز ۱، required در فاز ۲).

### 12.3 `docs/prompts/reel-XX-prompt.md`

افزودن بخش اجباری:

```markdown
## تفاوت اصلی با 3 ریل قبلی

[یک جمله — اجباری]
```

### 12.4 `PROMO_REEL_WORKFLOW.md`

- افزودن گام ۰: «Ideation & Creative Brief» قبل از گام ۱.
- افزودن گام ۴.۵: «Creative QA» بعد از visual-qa.
- افزودن قوانین ۸، ۹، ۱۰ (الزام خلاقیت).
- رفع تناقض «۶ قانون» vs «۷ قانون» و «۵۸s» vs «۵۹s».

---

## 13. ترتیب اجرا (برای agent)

**فاز ۱ (MVP — 1 هفته):**

1. ساخت `src/creative/types.ts` + `creative-dna.ts`.
2. ساخت `src/data/creative-moments.ts` (30 مورد).
3. ساخت `src/data/narrative-grammars.ts` (9 الگو).
4. ساخت `src/creative/novelty-score.ts`.
5. ساخت `scripts/variety-check.mjs`.
6. اتصال variety-check به build.
7. افزودن `creativeDNA` به یک ریل نمونه (reel-72) برای تست.
8. نوشتن تست `creative-novelty.test.ts`.

**فاز ۲ (2 هفته):** 9. ساخت `src/creative/creative-director.ts`. 10. ساخت `scripts/creative-brief.mjs`. 11. ساخت `src/creative/creative-qa.ts` (heuristic). 12. افزودن creativeDNA به همهٔ ریل‌های موجود (migration script). 13. ساخت `src/creative/reference-analyzer.ts` (فرم دستی).

**فاز ۳ (اختیاری):** 14. اتصال به TikTok Creative Center API. 15. Vision model برای Creative QA. 16. A/B testing با بازخورد واقعی (watch time, share, save).

---

## 14. قانون مطلق برای agent

**DO NOT:**

- engine موجود را حذف یا بازنویسی نکن.
- guardrails موجود را تضعیف نکن.
- variety-check را skip نکن.
- Creative DNA را optional در فاز ۲ بگذار (باید required شود).

**DO:**

- هر تغییر را با `npm test` و `npm run typecheck` و `npm run build` تأیید کن.
- هر ریل جدید را با `creative-brief.mjs` شروع کن.
- هر ریل را با `variety-check.mjs` تأیید کن.
- هر ریل را با `creative-qa.ts` نقد کن.

**DEFINITION OF DONE:**

- [ ] هر ریل جدید حداقل در 2 محور Creative DNA با 20 ریل قبلی متفاوت است.
- [ ] هر ریل حداقل 2 creative-moment جدید دارد.
- [ ] هر ریل حداقل یک narrativeGrammar متفاوت از 3 ریل قبلی دارد.
- [ ] variety-check.mjs در build اجرا و پاس می‌شود.
- [ ] creative-qa.ts حداقل 3 سوال تازگی را اجرا می‌کند.
- [ ] همهٔ تست‌ها سبز.
- [ ] typecheck 0 خطا.
- [ ] build موفق.

---

## 15. پرامپت کوتاه برای شروع (کپی-پیست)

```
You are refactoring the Hisabche promo-reel workflow into a Creative Intelligence Engine.

RULES:
- Do NOT delete or rewrite existing engine files (WordDrivenStage, sound, speech, guardrails, export-mp4, visual-qa).
- Add a NEW layer before src/reels/reel-XX.ts called src/creative/.
- Every reel must export a CreativeDNA object.
- Add variety-check.mjs that fails build if novelty < 0.6 against last 20 reels.
- Add creative-moments.ts with 30+ moments; each reel must use >=2 new ones.
- Add narrative-grammars.ts with 9 grammars; consecutive reels must differ.
- Add creative-qa.ts with 3 novelty questions (heuristic in phase 1).
- Update PROMO_REEL_WORKFLOW.md: add step 0 (Ideation) and step 4.5 (Creative QA), fix "6 vs 7 laws" and "58s vs 59s" contradictions.
- All tests must pass, typecheck 0 errors, build successful.

START WITH PHASE 1 (MVP). Do not jump to phase 2/3.
```

---

> **نکتهٔ نهایی:** این پرامپت یک **نقشهٔ راه** است، نه یک دستور اجرایی یک‌روزه. فاز ۱ (MVP) را ابتدا کامل کن، تست‌ها را سبز کن، سپس فاز ۲ را شروع کن. هر فاز باید مستقلاً قابل تست و قابل rollback باشد.
