# ریل 97 — «برگه‌ی امضا یا لینک کارمند؟» (L2.25) — مشخصات تولید

> **نگاشت:** L2.25 — `docs/100-VIDEO-PLAN.md`
> **بلوک تدوین کامل:** `docs/scenarios/L2.25-sign-sheet-or-link.md`
> **صحنه‌ها:** `src/scenes/attendance-ways.tsx` · **تم:** `cinematic-obsidian`
> **فرمت:** عمودی ۹:۱۶، ۱۰۸۰×۱۹۲۰، ۳۰ FPS، **34 ثانیه** (بیش از ۳۰ ثانیه — `docs/RUNTIME-AUDIT.md`)
> **صدا:** بدون گوینده؛ متن روی صحنه محتواست و نوار زیرنویس ندارد.
> **وضعیت:** `SCENE IMPLEMENTED` — **export تا وجود ضبط واقعی بسته است** (`blockedBy: PRODUCT_CAPTURE`).

## ضبط واقعی که لازم است (بیرون از مخزن)

`attendance-self.mp4` — صفحه‌ی `/my-attendance/[token]` — شرح دقیق صفحه و حداقل طول: `docs/CAPTURE-MANIFEST.md` (از خود ریل خوانده می‌شود).

## قواعد رعایت‌شده

- هم‌پوشانی با ریل‌های دیگر: `docs/OVERLAP-AUDIT.md`.
- قانون ۱۴: یک صحنه‌ی غالب، حداکثر ۶ کلمه‌ی غیرزیرنویس، بدون خط جداکننده؛ **هیچ متنی از کادر بیرون نمی‌زند** (`node scripts/check-frame-bounds.mjs 97`).
- قانون ۱۵ (صدا): `whoosh` روی تغییر صحنه، `pop` روی ظاهر شدن هر عنصر.
- قانون ۱۶ (تدوین): جدول ۱۱ ستونی و بخش‌های A تا H در فایل سناریو.
- قانون مدت: بیش از ۳۰ ثانیه.
- قاب آخر = قاب اول (حلقه).

## ثبت

`src/reels/reel-97-*.ts` · `src/reels/index.ts` · `src/data/reel-registry.ts` · `src/data/reel-ledger.json` · این فایل.
