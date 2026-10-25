# ریل 98 — «کدام فروش راکد ماند؟» (L3.05) — مشخصات تولید

> **نگاشت:** L3.05 — `docs/100-VIDEO-PLAN.md`
> **بلوک تدوین کامل:** `docs/scenarios/L3.05-which-sale-went-quiet.md`
> **صحنه‌ها:** `src/scenes/quiet-customers.tsx` · **تم:** `midnight-gold`
> **فرمت:** عمودی ۹:۱۶، ۱۰۸۰×۱۹۲۰، ۳۰ FPS، **35 ثانیه** (بیش از ۳۰ ثانیه — `docs/RUNTIME-AUDIT.md`)
> **صدا:** بدون گوینده؛ متن روی صحنه محتواست و نوار زیرنویس ندارد.
> **وضعیت:** `SCENE IMPLEMENTED` — **export تا وجود ضبط واقعی بسته است** (`blockedBy: PRODUCT_CAPTURE`).

## ضبط واقعی که لازم است (بیرون از مخزن)

`customers-outreach.mp4` — صفحه‌ی `/customers?tab=outreach` — شرح دقیق صفحه و حداقل طول: `docs/CAPTURE-MANIFEST.md` (از خود ریل خوانده می‌شود).

## قواعد رعایت‌شده

- هم‌پوشانی با ریل‌های دیگر: `docs/OVERLAP-AUDIT.md`.
- قانون ۱۴: یک صحنه‌ی غالب، حداکثر ۶ کلمه‌ی غیرزیرنویس، بدون خط جداکننده؛ **هیچ متنی از کادر بیرون نمی‌زند** (`node scripts/check-frame-bounds.mjs 98`).
- قانون ۱۵ (صدا): `whoosh` روی تغییر صحنه، `pop` روی ظاهر شدن هر عنصر.
- قانون ۱۶ (تدوین): جدول ۱۱ ستونی و بخش‌های A تا H در فایل سناریو.
- قانون مدت: بیش از ۳۰ ثانیه.
- قاب آخر = قاب اول (حلقه).

## ثبت

`src/reels/reel-98-*.ts` · `src/reels/index.ts` · `src/data/reel-registry.ts` · `src/data/reel-ledger.json` · این فایل.
