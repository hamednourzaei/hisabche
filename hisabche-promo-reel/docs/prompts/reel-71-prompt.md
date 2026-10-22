# Reel 71 Strategy Prompt — Full Business Cycle (42s Combined Template)

> **Reel ID:** 71  
> **Title:** چرخه کامل کسب‌وکار از فروش تا تسویه — ۴۲ ثانیه  
> **Creative Mechanism:** `cinematic-camera-orbit` + `continuous-transform` + `bridge-merge` + `split-reveal`  
> **Primary Templates:** `hook` → `cinematic-product` → `continuous-transform` → `split` → `bridge` → `cta`  
> **Visual Language:** `procedural-spatial` (dark studio, 2.5D camera orbits, neon data flows)  
> **Hook Mechanism:** `visual-pattern-interrupt` (colossal headline shattering Excel)  
> **Duration:** 42.0 seconds (6 scenes × ~7s each)  
> **Target Customer:** Wholesaler / Manufacturer / Multi-branch retailer  
> **SDK Version:** 1.0.0

---

## ۱. خلاصه استراتژیک (Strategic Summary)

این ریلز **اولین ریلز ترکیبی (Combined Template)** است که از یک singel `word-sync` فرار می‌کند و شش موتور صحنه‌ی متمایز را در یک روایت ۴۲ ثانیه‌ای به هم می‌پیوندد. هدف: نمایش **معماری هسته مرکزی** حسابچه به عنوان Single Source of Truth که پنج دامنه (فروش، انبار، دفتر، بانک، تولید) را در یک فاکتور واحد می‌چسباند.

**زاویه دوربین (Camera Angle):** صحنه ۲ (`cinematic-product`) از یک دوربین ۲.۵D با محور Z (parallax depth) استفاده می‌کند که به دور هسته مرکزی می‌چرخد — این همان «زاویه دوربین اوت» است که در پرامپت درخواست شده. لایه‌ها در عمق مختلف (z: 0–5) شناورند و با اسکرول/موش دوربین-parallax داشته باشند.

---

## ۲. معماری صحنه‌ها (Scene Architecture)

| Scene | Time      | Kind                   | Purpose                                                               | Camera / Motion Signature                                    |
| ----- | --------- | ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1     | 0.0–5.5   | `hook`                 | Pattern interrupt: 1 invoice = 5 disconnected systems                 | Static → sudden camera pull-back at "مگر نه؟"                |
| 2     | 5.5–12.5  | `cinematic-product`    | **Core Reveal**: 2.5D orbit around central core, 6 layers at z-depths | **Orbit camera** — continuous Y-axis rotation, parallax on Z |
| 3     | 12.5–20.0 | `continuous-transform` | Live transaction lifecycle: 5 stages, 7.5s flow                       | Seamless morph between stages, data flow lines               |
| 4     | 20.0–27.0 | `split`                | Side-by-side: Manual chaos vs Unified flow                            | Vertical divider, left red/right green, divider glows green  |
| 5     | 27.0–34.0 | `bridge`               | Offline resilience: POS continues, sync on reconnect                  | Two worlds merge, neon bridge, offline badge pulse           |
| 6     | 34.0–42.0 | `cta`                  | Dual-box conversion: resolution → search prompt                       | Box 1 hold 3.5s → flip → Box 2 brand hold 3s+                |

---

## ۳. هدایت صدا (Voiceover Direction)

### Persona

**معلم بازارِ باتجربه** — نه تبلیغاتی، نه آکادمیک. لحنی که صاحبان انبار و فروشگاه با آن هم‌صدا هستند: کوتاه، ته‌خط، با واژگان واقعی بازار (کسری، سررسید، قفسه، بوم، چک صیادی).

### Tone per Scene

- **Scene 1:** هشداردهنده، سریع، پر از بی‌قراری (۰–۳.۵ ثانیه)
- **Scene 2:** آرام، مطمئن، معماری‌گرا — لحن «معمار سیستم»
- **Scene 3:** روان، پیوسته، با rytm تیک‌تاک زنده — هر کلمه یک استیج جدید
- **Scene 4:** مقایسه‌ای، محکم، چپ با لحن ناراضی / راست با لحن راحت
- **Scene 5:** اطمینان‌دهنده، قدرتمند، «ما اینجا هستیم حتی وقتی نت نیست»
- **Scene 6:** مستقیم، دعوتلو، برند‌محور

### Word-Level Actions (Key Triggers)

| Word           | Scene | Visual Action                                   | Sound                |
| -------------- | ----- | ----------------------------------------------- | -------------------- |
| «یک»           | 1     | Single invoice drops from top                   | `impact`             |
| «پنج»          | 1     | Five icons orbit outward                        | `titleHit`           |
| «مگر نه؟»      | 1     | **Camera pulls back 2.5D** revealing full stage | `bigReveal`          |
| «حسابچه»       | 2     | Core logo pulses, camera begins orbit           | `chime`              |
| «می‌چسباند»    | 2     | All layers connect with neon lines              | `bigReveal`          |
| «لحظه فاکتور»  | 3     | Stage 1 highlight (invoice emit)                | `cash`               |
| «تسویه نهایی»  | 3     | Stage 2 highlight (payment)                     | `chime`              |
| «همه زنده است» | 3     | All 5 stages glow green simultaneously          | `financialMilestone` |
| «آشفتگی»       | 4     | Left panel red glow, particles                  | `alert`              |
| «یکپارچه»      | 4     | Right panel green flow lines, divider glows     | `successResolution`  |
| «قطع شد؟»      | 5     | WiFi icon breaks, cable snaps                   | `impact`             |
| «دوام میاد»    | 5     | Offline badge pulses, sync flash                | `success`            |
| «hisabche.com» | 6     | Brand lockup, hold 3s+                          | `ctaResolution`      |

---

## ۴. نکات تولیدی حیاتی (Production Guardrails)

### Camera Orbit (Scene 2) — Technical Spec

- **Orbit Radius:** 3.5 units from core
- **Rotation Speed:** 45° per second (slow, majestic)
- **Parallax Layers:** z = 0 (core) → 5 (outermost), each layer moves at `speed * (1 + z * 0.15)`
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` — exponential ease-out
- **Frame 0:** Stage pre-composed, camera already at starting angle
- **Climax Hold:** At `t = 5.0s` (word "می‌چسباند"), orbit pauses for 1.5s at hero angle

### Continuous Transform (Scene 3) — Seamless Morph

- No hard cuts between stages. Each stage morphs into next via:
  - `clipReveal` for text
  - `translateY(-20px) + scale(1.05)` for icons
  - Data flow lines draw with `stroke-dashoffset` animation
- **Climax:** At `t = 7.0s` (end of sentence), all 5 stage markers glow simultaneously for 1.5s

### Split Scene (Scene 4) — Clean Division

- Divider is a **neon line** at 50% width, not a border
- Left panel: `tone: 'red'` — subtle red glow on icons, not aggressive
- Right panel: `tone: 'green'` — cyan-green flow lines connecting points
- **Divider Label:** "مرز کنترل" appears at `t = 1.0s`, pulses at sentence ending

### Offline Bridge (Scene 5) — Visual Metaphor

- Left card: `offline` icon with subtle pulse animation
- Right card: `sync` icon with rotating arrows
- **Merge Moment:** At `t = 2.5s`, cards slide together, neon bridge forms, `merged` text types out
- **Caption:** Types out character-by-character (`typewriterClick` sound per char)

### CTA (Scene 6) — 3-Second Hold Rule

- Box 1 enters at `t = 0.3s`, holds at **100% opacity for 3.5s** (until `switchAt`)
- Flip transition: `rotateY(180deg)` with `clipReveal`, 0.6s duration
- Box 2 enters, holds at **100% opacity for 4.5s** (until end)
- **Brand Lockup:** `hisabche.com` in large monospace, centered, no animation after entry

---

## ۵. تایم‌کد دقیق (Precise Timing Code)

```text
0.00  ████████████████████████████████████████  SCENE 1: HOOK (5.5s)
      ├─ 0.00  Frame 0: 5 red cards floating, Excel shattered
      ├─ 0.30  "یک" — invoice drops
      ├─ 0.70  "فروش" — receipt reveal
      ├─ 1.20  "پنج" — 5 icons orbit
      ├─ 1.70  "صداع" — pain pulse
      ├─ 2.20  "جداگانه" — systems drift apart
      ├─ 3.20  "مگر نه؟" — CAMERA PULL BACK (cinematic)
      └─ 3.50  FREEZE ORBIT HOLD (1.5s) → transition

5.50  ████████████████████████████████████████  SCENE 2: CINEMATIC PRODUCT (7.0s)
      ├─ 5.50  Core logo pulse, orbit begins
      ├─ 5.70  "حسابچه" — core highlight
      ├─ 6.40  "هسته مرکزی" — layer 0 highlight
      ├─ 6.90  CAMERA ORBIT active (parallax layers)
      ├─ 7.40  "که همه را" — all layers connect
      ├─ 8.20  "می‌چسباند" — merge animation + ORBIT PAUSE
      ├─ 9.00  HOLD HERO ANGLE (1.5s)
      └─ 12.50 Seamless morph → SCENE 3

12.50 ████████████████████████████████████████  SCENE 3: CONTINUOUS TRANSFORM (7.5s)
      ├─ 12.50 Stage 1: Invoice emit
      ├─ 14.30 Stage 2: Payment chime
      ├─ 16.10 Stage 3: Warehouse scan
      ├─ 17.90 Stage 4: Production calc
      ├─ 19.70 Stage 5: Ledger glow
      └─ 20.00 ALL STAGES GREEN (1.5s hold) → transition

20.00 ████████████████████████████████████████  SCENE 4: SPLIT (7.0s)
      ├─ 20.00 Divider drops, panels slide
      ├─ 20.20 Left: Red chaos points (stagger 0.7s)
      ├─ 21.00 "چپ: آشفتگی" — pan left
      ├─ 22.00 Right: Green flow points (stagger 0.7s)
      ├─ 22.50 "راست: جریان" — pan right
      ├─ 23.50 "یکپارچه" — divider glows green
      └─ 27.00 Divider expands → transition

27.00 ████████████████████████████████████████  SCENE 5: BRIDGE (7.0s)
      ├─ 27.00 Left/Right cards enter
      ├─ 27.20 "اینترنت قطع شد؟" — wifi drop
      ├─ 28.50 "کسب‌وکار دوام میاد" — POS continues
      ├─ 29.50 MERGE: cards slide, bridge forms
      ├─ 30.50 Caption types out
      ├─ 31.50 Summaries appear (red→green)
      └─ 34.00 Bridge pulses → transition

34.00 ████████████████████████████████████████  SCENE 6: CTA (8.0s)
      ├─ 34.00 Box 1 enters (0.3s)
      ├─ 34.30 Box 1 HOLD 100% (3.5s)
      ├─ 37.50 SWITCH: rotateY flip
      ├─ 38.10 Box 2 enters (brand)
      ├─ 38.50 "hisabche.com" — brand reveal
      ├─ 39.00 Box 2 HOLD 100% (3.0s+)
      └─ 42.00 END — perfect end card
```

---

## ۶. چک‌لیست پیش‌ازبیلد (Pre-Build Checklist)

- [ ] تمام `spec.kind`ها در `scene-catalog.md` معتبرند
- [ ] تمام `ThemeName`ها: `procedural-spatial` / `cyber-emerald` معتبرند
- [ ] تمام `Tone`ها: `cyan`, `purple`, `red`, `green` معتبرند
- [ ] تمام آیکون‌ها در لیست ۴۰ آیکون مجاز هستند
- [ ] تمام `SoundKind`ها در مانیفست SFX موجودند
- [ ] `alignmentStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE'` و `isProvisional: true` در همه جملات
- [ ] `confidence: null` در همه `WordCue` و `SentencePlan`
- [ ] هیچ عدد هاردکد شده ارزی وجود ندارد
- [ ] هیچ واژه ممنوعه (`بار گم`, `آدرس بار`, ...) وجود ندارد
- [ ] متن روی صحنه ≤ ۶ واژه در هر لحظه (Hard Rule 14)
- [ ] CTA Box 2 hold ≥ 3.0s (Hard Rule 5)
- [ ] Scene exit fade-outs ≤ 0.18s
- [ ] Climax hold ≥ 1.5s در هر صحنه
- [ ] دوربین Scene 2: orbit + parallax پیاده‌سازی شده
- [ ] گارد AV Sync: هر `word.sound` یک `action` دارد

---

## ۷. دستورالعمل برای ویس‌آورتیست (Voiceover Artist Notes)

> **«این ریلز ۴۲ ثانیه است — طولانی‌تر از معمول. نفس بکش، سریع نگاه کن.»**

- **سرعت گفتار:** ۲.۲–۲.۵ کلمه/ثانیه (طبیعی، نه تپشده)
- **استراحت:** در انتهای هر جمله (Scene Ending) ۰.۵–۱ ثانیه مکث طبیعی
- **تاکید:** کلمات `emphasis: true` با کمی_volume بیشتر و توقف میکرو
- **Scene 2 (Orbit):** لحن «معمار» — آرام، با وقار، کلمات فنی را rõ راحت تلاوت کن
- **Scene 3 (Transform):** ریتم تیک‌تاک — هر کلمه یک ضربه ساعت
- **Scene 6 (CTA):** `hisabche.com` را با تلفظ جداگانه: «حِساب‑چِه دات کام»

---

## ۸. آپدیت‌های رجیستری (Registry Updates)

### `src/reels/index.ts`

```ts
import { reel71 } from './reel-71-full-cycle'
export const REELS: Reel[] = [ ..., reel71 ]
export { ..., reel71 }
```

### `src/data/reel-ledger.json`

```json
{
  "id": "71",
  "title": "چرخه کامل کسب‌وکار از فروش تا تسویه — ۴۲ ثانیه",
  "theme": "procedural-spatial",
  "hookFormula": "visual-pattern-interrupt",
  "dominantLayout": "cinematic-2.5d-orbit",
  "cardQuotaPercent": 12,
  "components": ["hook", "cinematic-product", "continuous-transform", "split", "bridge", "cta"]
}
```

### `.claude/reel-plugin/reel-state.json`

```json
{ "lastReelId": 71, "nextReelId": 72, "lastUpdated": "2026-10-21", "sdkVersion": "1.0.0" }
```

### `.claude/reel-plugin/recent-reels.json` — append:

```json
{
  "id": 71,
  "topic": "چرخه کامل کسب‌وکار از فروش تا تسویه",
  "creativeMechanism": "cinematic-camera-orbit",
  "primaryTemplate": "combined-multi-engine",
  "visualLanguage": "procedural-spatial",
  "hookMechanism": "visual-pattern-interrupt"
}
```

---

## ۹. وریفای سریع (Fast Verify)

```bash
cd hisabche-promo-reel
npm run typecheck    # باید ۰ خطا بدهد
npm test             # تست‌های motion-guardrails و av-sync-law باید سبز باشند
npm run build        # بیلد پروداکشن موفق
```

---

**نوشته شده توسط:** Senior SaaS Motion Director (Zero-Discovery Fast-Track)  
**تاریخ:** ۲۰۲۶-۱۰-۲۱  
**وضعیت:** `PROVISIONAL_CADENCE_MODEL_ACTIVE` — در انتظار ingest صدا و forced-alignment
