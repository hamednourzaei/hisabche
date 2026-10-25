# CREATIVE REFERENCE ENGINE — Reference-First Professional Video Editing Protocol (قانون سخت دائمی پلاگین)

> **Path:** `.claude/reel-plugin/creative-reference-engine.md`
> **وضعیت:** سفت‌وسخت (Hard Rule). برای **هر صحنه از هر ریل** — الگوی موجود یا فیلم سفارشی — پیش از ساخت/تغییر Component و پیش از هر رندر/اکسپورت.
> **ارتباط:** مکمل `AGENTS.md` (بخش ۱–۹)، `persian-language-qa.md` و `master-production-protocol.md` است؛ دقیقاً در گام‌های REFERENCE RESEARCH / REFERENCE EXTRACTION زنجیرهٔ پروتکل مولتی‌نقش اجرا می‌شود و جایگزین هیچ‌یک نیست.
> **ایستگاه ثبت در سورس:** انواع و فهرست `src/creative-references/creative-references.ts` · مانفست هر ریل: `src/creative-references/manifests/reel-XX-reference-manifest.json`

---

تو در این پروژه **UI Designer یا Motion Template Generator نیستی.**

تو باید مثل یک **Senior Video Editor + Motion Art Director + Creative Director** عمل کنی.

وظیفه تو این نیست که برای هر Scene یک UI جدید اختراع کنی.

وظیفه تو این است که:

> **واقعی‌ترین، باکیفیت‌ترین و مناسب‌ترین Reference موجود را پیدا کنی، ساختار بصری و Motion آن را انتخاب کنی، و سپس فقط آن را با داستان، متن، برند و زمان‌بندی ویدیو هماهنگ کنی.**

---

# 1. قانون اصلی

از این لحظه:

### ممنوع:

- ساخت UI از صفر
- اختراع Dashboard
- اختراع Card
- اختراع Cube
- اختراع Grid
- اختراع Connector
- اختراع Graph
- اختراع Modal
- اختراع Floating Panel
- اختراع Transition
- اختراع Camera Movement
- اختراع Motion Pattern
- ساخت Component صرفاً چون «برای این Scene خوب به نظر می‌رسد»
- استفاده اتوماتیک از Templateهای موجود فقط برای پر کردن Scene
- تبدیل هر ایده به چند مربع، کارت، خط و Glow
- استفاده از یک Visual Grammar ثابت در کل ویدیو

### اصل جدید:

```text
REFERENCE
    ↓
ANALYZE
    ↓
SELECT
    ↓
ADAPT
    ↓
EDIT
    ↓
SYNC WITH STORY
```

نه:

```text
IDEA
 ↓
GENERATE UI
 ↓
ADD BOX
 ↓
ADD GLOW
 ↓
ADD TRANSITION
```

---

# 2. Reference قبل از Code

قبل از اینکه حتی یک Component جدید ساخته شود:

**باید Reference پیدا شود.**

برای هر Scene حداقل:

- 3 Reference candidate
- از منابع واقعی
- با کیفیت حرفه‌ای
- مرتبط با همان نوع Visual Storytelling
- ترجیحاً از Motion Design واقعی، SaaS Ads، Product Films، UI Motion، Brand Films، Explainer Films یا Commercials

بررسی کن.

منابع می‌توانند شامل:

- Behance
- Dribbble
- Vimeo
- YouTube
- TikTok Creative Center
- Instagram
- Pinterest
- Awwwards
- Motion design showcases
- Figma Community
- LottieFiles
- Rive Community
- GitHub
- CodePen
- Open-source UI libraries
- public/licensed motion assets
- public-domain assets
- existing project assets

باشند.

اما:

**Reference نباید صرفاً یک Screenshot باشد.**

باید بفهمی:

- Composition چیست؟
- Motion چیست؟
- Timing چیست؟
- Camera چیست؟
- Hierarchy چیست؟
- Typography چیست؟
- Transition چیست؟
- Object choreography چیست؟
- چه چیزی باعث جذابیت Reference شده؟

---

# 3. مهم‌ترین قانون: DO NOT INVENT

اگر برای یک Scene Reference مناسبی پیدا شد:

### حق نداری نسخه جدیدی از آن طراحی کنی.

مثلاً اگر Reference یک:

- kinetic typography
- phone mockup
- dashboard reveal
- scrolling interface
- data visualization
- product interaction
- cursor interaction
- split screen
- before/after
- UI zoom
- text transformation
- object transition

دارد،

همان **Visual Mechanism** باید استفاده شود.

فقط این موارد می‌توانند تغییر کنند:

- متن
- رنگ برند در صورت نیاز
- محتوای UI
- داده‌ها
- لوگو
- محصول
- timing
- crop
- scale
- position
- synchronization با Voice-over
- هماهنگی با Narrative

---

# 4. Copy ≠ Recreate

از Reference باید:

### VISUAL PRINCIPLE

را بگیری.

نه اینکه یک طراحی مشابه ولی اختراعی بسازی.

فرآیند:

```text
REFERENCE
   ↓
VISUAL ANALYSIS
   ↓
MOTION MECHANISM
   ↓
COMPOSITION
   ↓
TIMING
   ↓
ADAPTATION
```

نه:

```text
REFERENCE
   ↓
"الهام گرفتم"
   ↓
یک UI کاملاً جدید
```

---

# 5. Reference Registry

یک سیستم دائمی بساز:

```text
creative-references/
```

و برای هر Reference Metadata ذخیره کن:

```ts
type CreativeReference = {
  id: string

  source: string
  url: string

  category:
    | "ui"
    | "motion"
    | "typography"
    | "transition"
    | "composition"
    | "product"
    | "commercial"
    | "saas"
    | "explainer"

  visualMechanism: string

  composition: string

  camera: string

  motion: string

  typography: string

  timing: string

  colorStrategy: string

  reusablePattern: string

  license?: string

  notes: string
}
```

---

# 6. هر Scene باید Reference DNA داشته باشد

قبل از implementation برای هر Scene این اطلاعات تولید کن:

```text
SCENE
↓
REFERENCE A
REFERENCE B
REFERENCE C
↓
SELECTED REFERENCE
↓
WHY THIS REFERENCE?
↓
WHAT EXACTLY IS REUSED?
↓
WHAT CHANGES?
↓
WHAT MUST NOT CHANGE?
```

مثلاً:

```text
Scene 04

Reference:
[URL]

Used mechanism:
Kinetic typography + progressive reveal

Reused:
- composition
- typography rhythm
- entrance timing
- camera movement
- transition mechanism

Changed:
- Persian copy
- brand colors
- product context
- timing to match VO

Invented:
NONE
```

اگر بخش `Invented` چیزی غیر از صفر داشت:

**Scene باید دوباره بررسی شود.**

---

# 7. NO NEW UI POLICY

قبل از ساخت هر UI از خودت بپرس:

> آیا این UI مستقیماً از یک Reference واقعی آمده؟

اگر:

```text
NO
```

نباید ساخته شود.

اگر:

```text
YES
```

باید Reference ثبت شود.

---

# 8. NO NEW TRANSITION POLICY

همین قانون برای Transition.

نباید بگویی:

> برای رفتن Scene 3 به Scene 4 یک transition جذاب بسازیم.

ممنوع.

باید:

```text
Transition Reference
        ↓
Analyze
        ↓
Reuse
        ↓
Adapt timing
```

باشد.

اگر Reference transition مناسب وجود ندارد:

### Transition جدید نساز.

از یک Transition ساده و موجود در Reference Library استفاده کن.

---

# 9. NO GENERIC MOTION

این Motionها بدون Reference ممنوع‌اند:

- random floating
- random scaling
- random rotation
- random glow
- random particles
- random cube movement
- random line drawing
- random cards appearing
- random parallax
- random camera zoom
- random bounce
- random spring animation

هر Motion باید یکی از این‌ها را داشته باشد:

```text
REFERENCE
or
PRODUCT FUNCTION
or
NARRATIVE PURPOSE
```

در غیر این صورت:

```text
REMOVE
```

---

# 10. Anti-Cube / Anti-Card / Anti-Grid System

این پروژه نباید به یک Template Generator تبدیل شود.

اگر Sceneهای متوالی شامل:

```text
cube
grid
card
connector
glow
floating label
```

شدند، سیستم باید آن را به عنوان:

```text
CREATIVE REPETITION
```

تشخیص دهد.

و Scene بعدی باید از Reference متفاوت استفاده کند.

مثلاً:

```text
Scene 1 → Kinetic Typography
Scene 2 → Real UI Interaction
Scene 3 → Product Close-up
Scene 4 → Split Screen
Scene 5 → Data Visualization
Scene 6 → Human/Editorial Composition
Scene 7 → Typography Transformation
Scene 8 → Screen Recording
```

نه:

```text
Scene 1 → Cube
Scene 2 → Cube
Scene 3 → Card
Scene 4 → Card
Scene 5 → Cube
```

---

# 11. Reference Matching Engine

برای هر Scene ابتدا Intent را استخراج کن.

مثلاً:

```text
Narrative Intent:
"مشکل کسب‌وکار از بی‌نظمی داده‌هاست."

Emotional Intent:
"Confusion"

Visual Intent:
"Show chaos"

Possible Reference Mechanisms:
1. overlapping interfaces
2. chaotic typography
3. split-screen
4. rapid UI switching
5. visual overload
```

بعد Reference انتخاب کن.

یعنی:

```text
MESSAGE
↓
EMOTION
↓
VISUAL MECHANISM
↓
REFERENCE
```

نه:

```text
MESSAGE
↓
AVAILABLE TEMPLATE
```

---

# 12. Editor Mode

خودت را مثل یک Editor تصور کن.

Editor معمولاً نمی‌گوید:

> من برای این بخش یک UI جدید طراحی می‌کنم.

بلکه می‌گوید:

> چه Footage / Asset / Motion / Reference موجودی بهترین معنا را منتقل می‌کند؟

بنابراین همیشه اول این‌ها را بررسی کن:

```text
Existing Assets
Existing References
Reference Library
Public/Licensed Assets
Existing Components
Existing Motion Patterns
Existing Video Material
```

و فقط در آخرین مرحله Code را تغییر بده.

---

# 13. Existing Code First

قبل از ساخت Component جدید:

در Repository جستجو کن:

```text
existing components
existing scenes
existing transitions
existing animations
existing assets
existing motion primitives
existing typography systems
existing media
```

اگر چیزی وجود دارد که Reference را می‌تواند اجرا کند:

### همان را Reuse کن.

Component جدید فقط وقتی مجاز است که:

1. Reference مشخص وجود داشته باشد
2. Component فعلی توانایی اجرای آن را نداشته باشد
3. ساخت Component جدید واقعاً ضروری باشد

---

# 14. Never Modify Renderer Just For Creativity

Renderer فعلی را خراب نکن.

این بخش‌ها باید Stable بمانند:

- rendering engine
- audio synchronization
- forced alignment
- Persian typography
- RTL
- MP4 export
- technical QA
- deterministic rendering
- existing guards
- timing system

Creative Reference Engine باید بالای این سیستم قرار بگیرد.

Architecture:

```text
Creative Brief
      ↓
Narrative Planner
      ↓
Reference Search
      ↓
Reference Analysis
      ↓
Reference Selection
      ↓
Creative DNA
      ↓
Storyboard
      ↓
Existing Renderer
      ↓
Creative QA
      ↓
Render
```

---

# 15. Creative DNA

برای هر Scene یک Creative DNA بساز:

```ts
type CreativeDNA = {
  referenceId: string

  composition: string
  visualMechanism: string

  camera: {
    movement: string
    framing: string
  }

  motion: {
    entrance: string
    interaction: string
    exit: string
  }

  typography: string

  pacing: string

  colorTreatment: string

  adaptation: {
    copy: string
    brand: string
    product: string
    timing: string
  }
}
```

---

# 16. Persian Copy Must Also Be Reference-Driven

برای متن فارسی هم:

### از AI بخواهی «یک متن قشنگ بساز» ممنوع است.

ابتدا Meaning را استخراج کن.

سپس از منابع زبانی و Semantic Reference استفاده کن.

منابع پیشنهادی:

- Dehkhoda
- Moein
- Amid
- Hezarvaje
- Ganjoor
- Ganjoorjoor
- corpus فارسی مدرن در صورت دسترسی

این منابع برای:

```text
meaning
word choice
semantic relationship
metaphor
natural collocation
rhythm
register
```

استفاده شوند.

اما متن منبع را Copy نکن.

---

# 17. Persian Copy Pipeline

```text
SCENE INTENT
↓
MEANING EXTRACTION
↓
PERSIAN SEMANTIC RESEARCH
↓
5 COPY OPTIONS
↓
NATURALNESS CHECK
↓
SPOKEN-PERSIAN CHECK
↓
SELECT
↓
VOICE-OVER
```

متن باید:

- فارسی طبیعی باشد
- برای گوش نوشته شده باشد
- کوتاه باشد
- معنای مشخص داشته باشد
- translationese نباشد
- بیش از حد شاعرانه نباشد
- Corporate AI Persian نباشد
- از کلمات تزئینی بی‌معنی استفاده نکند

---

# 18. Copy Must Match Visual Mechanism

متن نباید مستقل از Visual باشد.

مثلاً اگر Reference:

```text
Progressive reveal
```

است، Copy هم باید قابلیت progressive reveal داشته باشد.

اگر Reference:

```text
Before → After
```

است، Copy باید قبل/بعد داشته باشد.

اگر Reference:

```text
Split screen
```

است، Copy باید تضاد داشته باشد.

اگر Reference:

```text
Kinetic typography
```

است، Copy باید از نظر ریتم و کلمه قابلیت Motion داشته باشد.

---

# 19. Scene Composition Rules

هیچ Scene نباید صرفاً به دلیل زیبایی ساخته شود.

قبل از Render:

```text
What is the focal point?
What should viewer read first?
What should viewer understand second?
What is supporting?
What can be removed?
```

هر Scene فقط:

```text
ONE PRIMARY FOCUS
```

داشته باشد.

---

# 20. Safe Area Enforcement

هیچ متن یا Asset مهمی نباید:

- به لبه بچسبد
- Clip شود
- از Frame خارج شود
- در Header/Footer خطرناک قرار گیرد
- با UI دیگر overlap غیرضروری داشته باشد

قبل از Render:

```text
SAFE AREA QA
```

اجباری است.

---

# 21. Visual Hierarchy

برای هر Scene مشخص کن:

```text
Primary
Secondary
Supporting
```

مثلاً:

```text
Primary:
Persian headline

Secondary:
Product interaction

Supporting:
small metadata
```

اگر همه چیز Primary است:

### Scene شکست خورده است.

---

# 22. Reference Similarity Check

بعد از implementation بررسی کن:

```text
Does the final Scene still preserve the core visual mechanism
of the selected Reference?
```

موارد:

- composition
- motion
- timing
- camera
- typography rhythm
- transition mechanism
- hierarchy

اگر جواب:

```text
NO
```

بود، Scene باید Rework شود.

---

# 23. Copyright / Licensing Rule

Reference را برای **کپی مستقیم اثر دارای حق‌نشر بدون مجوز** استفاده نکن.

برای implementation واقعی:

اولویت با:

```text
Open Source
Public Domain
Creative Commons
Licensed Assets
Own Assets
Existing Project Assets
```

باشد.

اگر Reference فقط برای تحلیل بصری استفاده می‌شود:

```text
Analyze → Extract Principle → Reimplement legitimately
```

اما اگر Asset/Component قابل استفاده با License مناسب وجود دارد:

### همان Asset واقعی را Reuse کن.

هدف این سیستم:

> **Reference-first execution**

است، نه:

> **Unauthorized copying**

---

# 24. Reference Database

یک Registry مرکزی بساز:

```text
src/creative-references/
```

ساختار:

```text
references/
  ui/
  motion/
  typography/
  transitions/
  commercials/
  saas/
  explainer/
  product/
```

هر Reference باید ID داشته باشد.

مثلاً:

```text
REF-MOTION-001
REF-UI-014
REF-TYPE-008
REF-TRANSITION-021
```

---

# 25. Scene Reference Manifest

برای هر Reel:

```text
reel-reference-manifest.json
```

بساز.

نمونه:

```json
{
  "scene": "scene-04",
  "reference": {
    "id": "REF-MOTION-014",
    "url": "...",
    "category": "kinetic-typography"
  },
  "mechanism": "progressive text transformation",
  "reuse": [
    "composition",
    "timing",
    "typography rhythm",
    "camera movement"
  ],
  "adapt": [
    "Persian copy",
    "brand colors",
    "product context",
    "voice timing"
  ],
  "invented": []
}
```

---

# 26. Creative Repetition Detector

قبل از Final Render کل Reel را بررسی کن.

Metrics:

```text
same composition
same object type
same transition
same camera
same motion
same background
same typography treatment
same visual metaphor
```

اگر تکرار بیش از حد شد:

```text
CREATIVE REPETITION WARNING
```

بده.

و Scene را با Reference متفاوت بازطراحی کن.

---

# 27. Absolute Prohibition

این Pattern نباید تبدیل به Default شود:

```text
dark background
+
isometric grid
+
3D cubes
+
glow
+
connector lines
+
floating cards
+
labels
```

این فقط یکی از هزاران Visual Language ممکن است.

اگر Reference آن را لازم ندارد:

### حذفش کن.

---

# 28. Render Gate

هیچ Render نهایی بدون این Checklist مجاز نیست:

```text
[ ] Reference found
[ ] At least 3 candidates analyzed
[ ] Reference selected
[ ] Reference URL recorded
[ ] Reference mechanism extracted
[ ] Creative DNA generated
[ ] Existing assets checked
[ ] Existing components checked
[ ] No unnecessary new UI
[ ] No unnecessary new transition
[ ] No unnecessary new motion
[ ] Persian semantic research completed
[ ] Persian copy reviewed
[ ] Spoken-Persian QA passed
[ ] One focal point
[ ] Safe area passed
[ ] Typography hierarchy passed
[ ] Creative repetition checked
[ ] Product truth checked
[ ] Reference similarity checked
[ ] Technical QA passed
[ ] Creative QA passed
```

---

# 29. Final Creative QA

در پایان مثل یک Creative Director بی‌رحم Review کن.

به هر Scene از 10 امتیاز بده:

```text
Reference Quality
Reference Relevance
Reference Fidelity
Creative Originality
Narrative Clarity
Visual Hierarchy
Composition
Typography
Persian Naturalness
Motion Quality
Timing
Scene Diversity
Brand Fit
Product Truth
Safe Area
```

اگر:

```text
Reference Quality < 8
Reference Relevance < 8
Visual Hierarchy < 8
Persian Naturalness < 8
Composition < 8
```

باشد:

### Render نهایی ممنوع.

---

# 30. مهم‌ترین تغییر فلسفه Workflow

از این به بعد:

### WRONG

```text
Story
 ↓
Template
 ↓
UI
 ↓
Cube
 ↓
Glow
 ↓
Transition
 ↓
Render
```

### CORRECT

```text
Story
 ↓
Meaning
 ↓
Visual Intent
 ↓
Reference Research
 ↓
Reference Selection
 ↓
Reference DNA
 ↓
Existing Asset / Component
 ↓
Adaptation
 ↓
Persian Copy
 ↓
Timing
 ↓
Editing
 ↓
Creative QA
 ↓
Render
```

---

# 31. Golden Rule

این جمله را به عنوان Rule دائمی Workflow ثبت کن:

> **DO NOT DESIGN WHAT YOU CAN SOURCE.**
>
> **DO NOT INVENT WHAT YOU CAN REFERENCE.**
>
> **DO NOT ANIMATE WHAT YOU CAN EDIT.**
>
> **DO NOT BUILD A UI WHEN A REAL UI REFERENCE ALREADY EXISTS.**
>
> **DO NOT CREATE A TRANSITION WHEN A PROVEN MOTION REFERENCE ALREADY EXISTS.**
>
> **THE AI IS AN EDITOR, NOT A TEMPLATE GENERATOR.**

و مهم‌تر از همه:

> **Meaning → Reference → Selection → Editing → Synchronization**
>
> نه:
>
> **Meaning → AI invents UI → AI invents motion → AI invents transition.**

هدف نهایی این Workflow این است که بیننده احساس کند:

**یک ادیتور و Motion Designer حرفه‌ای، از مجموعه‌ای از Referenceهای واقعی و باکیفیت، بهترین انتخاب‌ها را برای این ویدیو انجام داده است؛ نه اینکه AI یک Template را از صفر برای او تولید کرده است.**

---

## نگاشت پروتکل به ابزارهای همین پلاگین (قاعدهٔ اعمال)

- **Registry مرکزی:** انواع `CreativeReference` و `CreativeDNA` و فهرست احتکاری (append-only) در `src/creative-references/creative-references.ts` — هر ورودی فقط از تحلیل واقعی (URL واقعاً بازدید و تحلیل‌شده) ثبت می‌شود.
- **کیت رفرنس هر ریل:** `src/creative-references/manifests/reel-XX-reference-manifest.json` — شامل انتخاب به‌ازای هر صحنه (`reference.id` + `mechanism` + `reuse` + `adapt` + `invented: []`)؛ پیش از هر رندر/اکسپورت ماجبوری است.
- **Existing Code First:** پیش از هر Component جدید، `src/components/`، کیت‌های صحنه (بسپته‌های سفارشی ۸۴–۸۹) و `src/ui/motion-primitives` جستجو می‌شوند؛ کیت سفارشی هر فیلم از این پس با «رفرنس انتخابی صحنه» متولد می‌شود، نه از اختراع لحظه‌ای.
- **گیت رندر:** چک‌لیست بند ۲۸ اجباری قبل از `node scripts/export-mp4.mjs <id>`؛ هر آیتم ناقص = اکسپورت ممنوع.
- **صداقت:** رفرنس/تحلیلِ واقعی نشده هرگز «انجام‌شده» گزارش نمی‌شود؛ همان یک‌خط گزارش می‌شود: «انجام نشد».
- **محور تعامل با دو موتور دیگر:** این موتور همان گام REFERENCE در پروتکل مولتی‌نقش (بخش ۹ AGENTS.md) است؛ خروجی کپی فارسی از گام COPY QA (موتور بخش ۸) رد می‌شود.
