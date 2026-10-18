# Reel #70 — «ulyssexbt: Genesis Block»

Brand identity motion showcase (15.0 ثانیه، ۴ صحنه) — تم `kinetic-manifesto`، چیدمان `full-bleed-kinetic`، قلاب `visual-pattern-interrupt`.

منبع ایده: در خواست کاربر برای «striking 15-second motion graphics piece built around ulyssexbt name» —uie همان قلابی که در هیچ تایتری ۰۱–۶۹ نبوده: **فریم ۰ کاوس هندسی که به وردمارک فریز می‌شود**.

---

## ۱. قلاب میخکوب (S1, 0–3.5s)

- فریم ۰: ۱۲۰ ذره (▲ ■ ● ◆ ▼) در spirals فيبوناچی، در حال حرکت آرام.
- ساعت ۰.۱۵: ضربه `impact` → کل میدان **فریز** می‌شود (حرکت صفر می‌شود).
- ساعت ۱.۳: `ulyssexbt` با spring گنده وسط قفل می‌شود، برچسب `GENESIS` ظاهر می‌شود.
- VO: «ulyssexbt — ژنسیس.» — هیچ واحد پولی، فقط نام برند.

## ۲. بلاک‌چین عددی (S2, 3.5–7.5s)

- کارت بلاک: `BLOCK 847291` با اودومتر monotonic.
- هش: `0x0000...d4f8` — صفرهای پیشرو با انیمیشن reveal.
- تایم‌استمپ: `17082026` تایپ लेखक.
- VO: «بلاک ۸۴۷۲۹۱ — هش ۰۰۰۰... — تایم‌استمپ ۱۷۰۸۲۰۲۶.»

## ۳. شبکه نودها (S3, 7.5–11.5s) — اوج درام

- ۱۲۸ نود روی کره射影، به‌ترتیب ignition.
- ساعت ۹.۷: `0 ms` لیتنسی با چایم سبز.
- ساعت ۱۰.۵: موج `SYNC` بر روی کل شبکه.
- VO: «۱۲۸ نود — ۰ تاخیر — همگامی فوری.»

## ۴. قفل نهایی (S4, 11.5–15s) — CTA

- `ulyssexbt` groß، درخشان طلایی.
- مهر `TRUST` سبز با آیکون ⬡.
- `ulyssexbt.com` تایپ‌نویس.
- VO: «ulyssexbt — کدِ اعتماد. ulyssexbt.com»
- CTA ≥ ۳ ثانیه در opacity کامل.

---

## صدا و قانون AV-Sync (Hard Rule 13)

- هر واژه صدا‌دار → `action` در اکتر، خوانده شده با `cueAt`.
- `sentenceEnding`ها بی‌صدا.
- فاصله cueها ≥ ۱۲۰ms.

---

## Registration (۷ مرحله)

1. `src/reels/reel-70-ulyssexbt-genesis.ts` ✅
2. `src/components/Reel70UlysseXBTActors.tsx` + dispatch `r70-` ✅
3. `.r70-*` در `src/styles.css` ✅
4. `src/reels/index.ts` (import + REELS + export) ✅
5. `src/data/reel-ledger.json` (id 70) ✅ · رجیستری (id 70) ✅
6. `docs/prompts/reel-70-prompt.md` ✅
7. `recent-reels.json` (id 70) ✅ · `reel-state.json` → nextReelId 71 ✅

## گارد

- متن روی صحنه ≤ ۶ واژه (تنها برند، اعداد بلاک، هش، نود، لیتنسی، TRUST، URL).
- بدون خط جدای افقی؛ بدون نام ارز؛ همه اعداد `faNumber`.
- گیت رجیستری: شباهت با ۶۹ < ۳۵٪ (آرک‌تایپ/چیدمان/رنگ/صدا همگی متفاوت).
- صدا: PROVISIONAL_CADENCE_MODEL_ACTIVE — تا `node scripts/align-voiceover.mjs 70`.
