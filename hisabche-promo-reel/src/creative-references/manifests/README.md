# Scene Reference Manifests — Creative Reference Engine

> قاعده: `.claude/reel-plugin/creative-reference-engine.md` (بندهای ۲۴–۲۵ و ۲۸)

- برای **هر ریل** یک فایل `reel-XX-reference-manifest.json` اینجا ساخته می‌شود.
- هر فایل، به‌ازای هر صحنه، ذی‌نام بند ۲۵ پروتکل: `reference.id` (ID واقعی ثبت‌شده در
  `src/creative-references/creative-references.ts`) + `mechanism` + `reuse` + `adapt` + `invented` (باید `[]` باشد).
- پیش از هر رندر/اکسپورت (`node scripts/export-mp4.mjs <id>`) مانفست باید کامل باشد — رندر بدون مانفست ممنوع.
- رفرنس فیک، URL از حافظه یا مدعای تحلیلِ انجام‌نشده مطلقاً ممنوع؛ تحلیل ناتمام صادقانه «انجام نشد» گزارش می‌شود.
