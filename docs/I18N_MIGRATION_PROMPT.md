# Prompt — یکسان‌سازی i18n (next-intl only)

فایل `docs/SESSION_HANDOFF.md` را اول بخوان (کانتکست پروژه آنجاست).

**کار:** پروژه الان دو سیستم i18n موازی دارد: next-intl فقط برای routing (`fa`/`af`/`en`) و react-i18next برای متن UI (locale files با کد متفاوت `fa-IR`/`fa-AF`). این را یکی کن: همه‌چیز فقط next-intl، `useTranslation`/`t()` هر کامپوننت را با `useTranslations` از next-intl جایگزین کن، locale JSON های `packages/i18n/src/locales/*.json` را به فرمت next-intl (`apps/web/messages/{fa,af,en}/common.json` که از قبل وجود دارد) merge کن، `fa-IR`/`fa-AF` را همه‌جا حذف کن و فقط `fa`/`af`/`en` بماند.

**قوانین اجرا (الزامی):**
- بدون سؤال شروع کن، مستقیم برو سراغ کد.
- حداکثر ۳ جمله تحلیل قبل از هر تغییر — تمرکز کامل روی کد.
- قبل از هر ادعا Root Cause را با خواندن کد واقعی Verify کن، حدس نزن.
- کار را در batch های ۵-۱۰ فایلی انجام بده، بین batch ها فقط `npx tsc --noEmit` (نه build کامل).
- هر پکیجی که لازم شد (`next-intl` نسخه‌ی سازگار با Next 16، یا هر type‌ helper) را خودت با npm نصب کن، منتظر تأیید نمان.
- Build کامل (`npm run build`) را فقط در انتهای کل کار یا هر ۱۰ iteration اجرا کن.
- هیچ Feature را نیمه‌کاره رها نکن؛ اگر یک کامپوننت را migrate کردی، تست کن که هنوز کامپایل می‌شود قبل از رفتن به بعدی.
- در پایان یک خلاصه‌ی کوتاه (نه گزارش مفصل) از فایل‌های تغییریافته بده.

شروع کن.
