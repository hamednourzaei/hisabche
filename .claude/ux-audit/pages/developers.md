# توسعه‌دهندگان — `/developers`

> بخشی از بازبینی UX حسابچه (۴ اکتبر ۲۰۲۶). روش: `.claude/skills/hisabche-ux-consolidation/SKILL.md`.
> واقعیت‌ها از اسکن ایستای کد آمده‌اند؛ هیچ صفحه‌ای رندر نشده است.

## این صفحه برای چیست

کلید API، وب‌هوک، برنامه‌ها، دستیارهای AI.

## حکم

|                        |                                               |
| ---------------------- | --------------------------------------------- |
| **حکم**                | `KEEP` — بماند                                |
| **فاز**                | ج — تنظیمات، اشتراک، حاکمیت                   |
| **نقش در ساختار تازه** | هاب — صفحه‌های دیگر به‌صورت تب این‌جا می‌آیند |

## واقعیت‌ها (از کد)

|                                    |                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| فایل صفحه                          | `apps/web/app/[lang]/(dashboard)/developers/page.tsx`                                                  |
| کانتینر                            | `DevelopersContainer` — `packages/ui/src/components/ui/developers/containers/developers-container.tsx` |
| حجم کد صفحه و اجزای نزدیک          | 2583 خط در 9 فایل                                                                                      |
| در منو                             | نه                                                                                                     |
| ماژول دسترسی (`NAV_MODULE`)        | ندارد (قفل نمی‌شود)                                                                                    |
| route در app-shell (ویندوز/موبایل) | بله                                                                                                    |
| بسته در robots                     | بله                                                                                                    |
| مقاله‌ی راهنما                     | `developers`                                                                                           |
| تعداد دیالوگ/شیت                   | 0                                                                                                      |
| تعداد کنترل فرم                    | 12                                                                                                     |
| جدول                               | 1                                                                                                      |

**تب‌ها / بخش‌ها:** ندارد

**خواندن‌ها (17):**

- `useApiKeys`
- `useDeveloperCatalog`
- `useRetryWebhookDelivery`
- `useWebhookDeliveries`
- `useWebhookEndpoints`
- `useApiKeyUsage`
- `useReplayWebhook`
- `useStorefrontSettings`
- `useOAuthApps`
- `useAppVersions`
- `useAppScreenshots`
- `useAppStats`
- `useUninstallApp`
- `useAppUpdatePreview`
- `useSandboxStatus`
- `useAiActionRequests`
- `useDecideAiActionRequest`

**نوشتن‌ها (26):**

- `useCreateApiKey`
- `useCreateWebhookEndpoint`
- `useDeleteWebhookEndpoint`
- `useRevokeApiKey`
- `useRotateWebhookSecret`
- `useSendWebhookTest`
- `useUpdateWebhookEndpoint`
- `useSaveStorefrontSettings`
- `usePublishableKeys`
- `useCreatePublishableKey`
- `useRevokePublishableKey`
- `useCreateOAuthApp`
- `useUpdateOAuthApp`
- `useSubmitAppVersion`
- `useRotateOAuthSecret`
- `useRotateAppWebhookSecret`
- `useDeleteOAuthApp`
- `useAddAppScreenshot`
- `useUploadAppImage`
- `useRemoveAppScreenshot`
- `usePublisherProfile`
- `useSavePublisherProfile`
- `useInstalledApps`
- `useApplyAppUpdate`
- `useCreateSandbox`
- `useResetSandbox`

**به این صفحه‌ها می‌رود:**

- `/orders`
- `/marketplace`

**از این صفحه‌ها به آن می‌رسند:**

- `/settings`

**حالت‌ها (جستجوی متنی در کد):** بارگذاری بله · خطا بله · خالی بله · بدون دسترسی بله · «تنظیم نشده» بله

## یافته‌ها

### 1. شدت 2 — ۲۶ نوشتن و ۲٬۵۰۰ خط در یک صفحه، و `/marketplace` جدا.

- **چرا مهم است:** بازار برنامه‌ها همان «چه چیزی به حساب من وصل است» است.
- **پیشنهاد:** تب «برنامه‌ها» همین‌جا. خودش در منو نیست و فقط از تنظیمات باز می‌شود — همین بماند.

## اگر تأیید شود، چه چیزی عوض می‌شود

نشانی می‌ماند. تب‌های تازه (هر کدام lazy و در URL با `?tab=`) اضافه می‌شوند و کانتینرهای موجودِ صفحه‌های ادغام‌شده را سوار می‌کنند. قفل ماژول هر تب حفظ می‌شود.
