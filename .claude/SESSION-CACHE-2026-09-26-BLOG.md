# سشن ۲۶ سپتامبر ۲۰۲۶ — وبلاگ و ورود روی صفحات عمومی

> درخواست‌های ۱۴۵–۱۵۲ در `USER-REQUESTS.md`؛ باگ‌ها BUG-028 و BUG-029 در `BUG-REGISTRY.md`.
> این فایل «چرا»ها و تله‌هایی را نگه می‌دارد که در کد دیده نمی‌شوند.

---

## ۱. نقشه‌ی وبلاگ — کجا چیست

| لایه                                                               | فایل                                                                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| تحقیق و کلمات کلیدی                                                | `.claude/research/blog-keywords.md`                                                                                   |
| migration + verify                                                 | `docs/blog-migration.sql` · `docs/VERIFY-blog.sql`                                                                    |
| واژگان مشترک (فونت، اندازه، slug رزرو، چک‌لیست سئو، ادعاهای ممنوع) | `packages/validation/src/schemas/blog.schema.ts`                                                                      |
| Core                                                               | `backend/src/services/blog/` (domain · sanitize · repository · service · revalidate)                                  |
| روت‌ها                                                             | `backend/src/routes/blog.routes.ts` — عمومی / کاربر / `/api/admin/blog/*`                                             |
| وب (server)                                                        | `apps/web/app/[lang]/blog/**` · `apps/web/lib/blog-api.ts` · `apps/web/app/api/revalidate/route.ts`                   |
| UI                                                                 | `packages/ui/src/components/ui/blog/*` · `navigation/public-auth-actions.tsx` · `.blog-prose` در `styles/globals.css` |
| island تعامل                                                       | `blog-post-actions.tsx` + `packages/api/src/hooks/blog.ts`                                                            |
| ادمین                                                              | `apps/admin/components/blog/*` · `apps/admin/hooks/use-admin-blog.ts`                                                 |
| گاردها                                                             | `blog.pg` · `blog-core` · `blog-routes` · `blog-web-seo` · `admin-blog` · `landing-claims` · `rls-coverage`           |

## ۲. تله‌هایی که خوردم (هر کدام وقت واقعی گرفت)

1. **zustand در SSR و hydration وضعیتِ پیش از persist را می‌دهد.** `useStore` نسخه‌ی 4.5.7 برای server snapshot از
   `getServerState || getInitialState` استفاده می‌کند. پس خواندن store با **هوک** هنگام render mismatch نمی‌سازد؛ فقط
   `getState()` یا `window`/`document` در render می‌سازد. من اول خلافش را در کامنت نوشتم؛ تست تزریقی قرمز نشد و ادعا اصلاح شد.
   قرارداد «بعد از mount» را `useSignedInAfterMount` صریح نگه می‌دارد.
2. **ISR در این اپ بدون `generateStaticParams` نمی‌شود.** `[lang]` layout آن را ندارد، پس هر صفحه‌ی زیرش `ƒ` (هر بار render) است.
   `generateStaticParams() { return [] }` → `●`: بیلد به API نیاز ندارد و صفحه بعد از اولین درخواست cache می‌شود.
3. **config قطعه (`revalidate`) باید لیترال باشد.** `export const revalidate = SOME_CONST` را Next نمی‌خواند.
   مقدار در `lib/blog-api.ts` ثابت است و گارد برابریِ لیترال‌ها را می‌سنجد.
4. **Next 16: `revalidateTag(tag, profile)` آرگومان دوم اجباری دارد.** `{ expire: 0 }` یعنی درخواست بعدی تازه render شود.
5. **stripper کامنت: اول `--`/`//`، بعد `/* */`.** glob در کامنت خطی (`services/accounting/*`) کامنت بلوکی جعلی باز می‌کند
   (BUG-029). سه گارد در همین سشن گرفتارش شدند.
6. **`glob.glob` در پایتون `[lang]` را کلاس کاراکتر می‌خواند.** برای مسیرهای Next از `os.walk` استفاده کن.
7. **embedded-postgres روی root:** `createPostgresUser: process.getuid?.() === 0` — روی ماشین عادی خاموش می‌ماند.
8. **`zodToJsonSchema` → TS2589.** بقیه‌ی روت‌ها با `any` فرار کرده‌اند (ممنوع §۱۰). schema پاسخ را دستی بنویس؛
   nullable را صریحاً `['string','null']`. گارد `blog-routes.test.ts` پاسخ واقعی را از serializer رد می‌کند.
9. **anon هیچ policy ندارد** (`rls-coverage`: «grants nothing to the anon role»). سایت از طریق بک‌اند می‌خواند؛
   policy عمومی برای anon هم لازم نبود هم ممنوع.
10. **نوشتن چندجدولی = تابع Postgres**، حتی پست + تگ (`blog_save_post`). اول با دو فراخوان نوشتم و برگرداندم.

## ۳. تصمیم‌ها

- **کلاینت هیچ مجوز نوشتنی روی جداول وبلاگ ندارد، حتی ردیف خودش.** «فقط ردیف خودش» در بک‌اند اعمال می‌شود (user_id از توکن،
  کلید `(post_id, user_id)`). وگرنه کامنت با PostgREST مستقیم از rate limit و honeypot رد می‌شد.
- **ادعاهای ممنوع یک فهرست‌اند** (`CLAIMS_NOT_IN_PRODUCT`): لندینگ، کپی وبلاگ، و هشدارِ هر ذخیره‌ی مقاله. برای مقاله
  هشدار است نه رد — توضیح یک مفهوم مجاز است، ادعای داشتنش نه.
- **برچسب کم‌محتوا (< ۳ مقاله) noindex** و بیرون از sitemap؛ همان عدد در بک‌اند و وب.
- **نویسنده فقط از پروفایل واقعی**؛ بدون نام → سازمان در JSON-LD. اعتبار نویسنده (E-E-A-T) منتظر اطلاعات کاربر (#152).
- **زمان‌بندی بدون cron:** `scheduled` + `published_at ≤ now()` خودش عمومی است؛ ISR ساعتی آن را برمی‌دارد.
