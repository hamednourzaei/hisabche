# ONE-CLICK AI ARTICLE — اسکوپ و فازبندی

> تاریخ: ۳۰ سپتامبر ۲۰۲۶ · ادامه‌ی `CONTENT-INTELLIGENCE-SCOPE.md`
> قاعده: **یک بلاگ، یک CMS، یک ویرایشگر، یک AI provider، یک صف، یک audit**

---

## ۱. آنچه **هست** و دست نمی‌خورد

| چیز                   | مسیر                                            |
| --------------------- | ----------------------------------------------- |
| صفحه‌ی «مقاله‌ی جدید» | `apps/admin/app/[lang]/(admin)/blog/new/`       |
| ویرایشگر Tiptap       | `components/blog/post-editor-client.tsx` (۲۱KB) |
| ویرایشگر مقاله        | `components/blog/blog-editor.tsx` (۱۹KB)        |
| **پنل SEO**           | `components/blog/seo-panel.tsx`                 |
| AI settings           | ادمین → AI Settings (`AiSettingsService`)       |
| AI provider           | `AiProvider = 'anthropic' \| 'openai'`          |
| AI quota              | `services/ai/ai-quota.service.ts`               |
| job                   | `distributed-work.ts` (claim اتمیک)             |
| sanitize              | `services/blog/blog.sanitize.ts`                |
| audit                 | `AuditService`                                  |
| toast/loading         | `packages/ui`                                   |

⚠️ **قانون:** دکمه فقط به همین‌ها وصل می‌شود. **نه** API key جدید، **نه**
provider جدید، **نه** صفحه‌ی تنظیمات جدید، **نه** ویرایشگر دوم.

---

## ۲. شکاف واقعی — بعد از خواندن `post-editor-client.tsx`

⚠️ **خبر خوب:** صفحه‌ی «مقاله‌ی جدید» **همان ویرایشگر** است:

```tsx
// app/[lang]/(admin)/blog/new/page.tsx
export default function AdminBlogNewPage() {
  return <PostEditorClient id={null} /> // ← همان کامپوننت
}
```

پس **ویرایشگر دوم ساختن لازم نیست** — فقط باید راهی باشد که AI خروجی را
**در همان `FormState` بریزد**.

### `FormState` — دقیقاً همان چیزی که AI باید پر کند

```ts
interface FormState extends SeoFields {
  locale · title · excerpt
  html: string                    // ← محتوا، از sanitizer رد شده
  json: Record<string, unknown> | null   // ← Tiptap doc
  faq: BlogFaqItem[]
  coverUrl · coverAlt
  status: BlogPostStatus          // ← DRAFT. هرگز خودکار عوض نمی‌شود
  publishedAt · categoryId
  tagIds: string[]
  translationGroupId: string | null
}
```

⚠️ **همه‌ی فیلدهایی که پرامپت فهرست کرده، همین‌جا هستند.** یعنی هدف
«همه را پر کن» دقیقاً یک `Partial<FormState>` است — و `setForm` از قبل وجود دارد.

### آنچه واقعاً کم است

| نیاز                                  | چرا لازم است                                        |
| ------------------------------------- | --------------------------------------------------- |
| **دکمه** در بالای صفحه                | نقطه‌ی ورود                                         |
| **prop اختیاری** برای پرکردن از بیرون | `<PostEditorClient id={null} applyGenerated={…} />` |
| **dialog موضوع** وقتی عنوان خالی است  | پرامپت بند ۵                                        |
| **progress**                          | `job.status`                                        |
| **`clientRequestId`**                 | بند ۳۰ — idempotency                                |
| **guard دکمه‌ی publish**              | بند ۱۸ — job هرگز publish نمی‌کند                   |
| **job_type**                          | `content_research` · `content_generate`             |

⚠️ **`status` در `FormState` هست** ⇒ اگر AI آن را `published` بگذارد، مستقیم منتشر
می‌شود. باید **نادیده** گرفته شود، نه فقط پیش‌فرض.

### چیزی که هنوز ندیدم

⚠️ `PostEditorClient` ۲۱KB است و فقط ابتدایش را خواندم. قبل از نوشتن باید بدانم
`save` چه می‌فرستد و آیا `slug` خودکار ساخته می‌شود یا نه — چون بند ۱۷
پرامپت می‌گوید «تکراری نشود، بازنویسی نکن».

---

## ۳. جریان — یک کلیک، هفت مرحله در پس‌زمینه

```
موضوع
  ↓
① Research        Tavily × 3 زبان، موازی، بدون تکرار
  ↓
② Sources         دسته‌بندی primary/secondary/competitor
  ↓
③ Content Brief   قابل ویرایش توسط سردبیر
  ↓
④ Outline         بدون اجبار ساختار یکسان
  ↓
⑤ Original Draft  زبان طبیعی، سناریوی واقعی
  ↓
⑥ SEO + FAQ + لینک داخلی
  ↓
⑦ Quality Gate    ۸ بررسی
  ↓
فرم Tiptap + پنل SEO  ← خروجی اینجاست
  ↓
DRAFT            ← همیشه. هرگز publish
  ↓
بررسی انسان
  ↓
انتشار
```

⚠️ **خروجی در `DRAFT` می‌نشیند، نه در `PUBLISHED`.** `status` فعلی سه‌مقداری
است و **مهاجرت نمی‌شود**.

---

## ۴. هشت قاعده‌ی سخت‌کاری

| #   | قاعده                                  | چطور در کد enforce می‌شود                  |
| --- | -------------------------------------- | ------------------------------------------ |
| ۱   | **AI هرگز publish نمی‌کند**            | job هیچ‌جا `publish` صدا نمی‌زند · guard   |
| ۲   | **ورودی کاربر پاک نمی‌شود**            | تشخیص `dirty fields` · سه گزینه            |
| ۳   | **API key از مرورگر نمی‌آید**          | server-side resolve از `AiSettingsService` |
| ۴   | **URL هرگز از مدل ساخته نمی‌شود**      | فقط از پاسخ Tavily                         |
| ۵   | **دکمه دوبار کلیک، دو مقاله نمی‌سازد** | `clientRequestId` + قید یکتا               |
| ۶   | **خروجی AI اعتبارسنجی می‌شود**         | Zod، قبل از هر نوشتن                       |
| ۷   | **متن تولیدی از sanitizer می‌گذرد**    | `blog.sanitize.ts` موجود                   |
| ۸   | **بدون provider، خطای صریح**           | نه warning، نه خروجی خالی                  |

---

## ۵. قرارداد خروجی — سخت‌گیر، بدون حدس

⚠️ پرامپت گفته «AI نباید prose دلخواه برگرداند که backend باید حدس بزند».
یعنی **یک schema واحد** که از مدل خواسته می‌شود JSON بدهد، و با Zod اعتبارسنجی می‌شود.

```ts
interface GeneratedArticle {
  title: string
  slug: string
  excerpt: string
  contentHtml: string
  categoryId: string | null
  tags: string[]
  metaTitle: string
  metaDescription: string
  faq: { question: string; answer: string }[]
  readingTime: number
  internalLinks: { target: string; anchor: string; reason: string }[]
  sources: { url: string; title: string; sourceType: 'primary' | 'secondary' | 'competitor' }[]
  cta: string | null
  qualityNotes: string[]
}
```

⚠️ `qualityNotes` **اجباری** است — اگر AI نتوانست چیزی را تأیید کند، باید
بگوید. خلأ باید **پر** باشد نه خالی.

---

## ۶. فازبندی

| فاز   | کار                       | پرونده‌های تازه      | مهاجرت        |
| ----- | ------------------------- | -------------------- | ------------- |
| **۰** | `callProvider` مشترک      | `provider-client.ts` | — ✅ **تمام** |
| **۱** | schema پایه + RLS         | ۳ جدول               | ۱             |
| **۲** | research job (Tavily × ۳) | —                    | —             |
| **۳** | brief + outline           | ۱                    | ۲             |
| **۴** | draft + version           | ۱                    | ۳             |
| **۵** | quality gate              | ۱                    | ۴             |
| **۶** | لینک داخلی + orphan       | ۱                    | ۵             |
| **۷** | **دکمه + جریان ادمین**    | —                    | —             |

⚠️ **فاز ۷ همان چیزی است که شما دیدید.** ولی بدون ۱ تا ۶ دکمه فقط
`generateText()` ساده است — و دقیقاً همان چیزی که خودتان گفتید نباید باشد.

---

## ۷. سه چیزی که **قبل از فاز ۱** لازم است

| #   | چیز                           | چرا                                                                                                                           |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ۱   | `TAVILY_API_KEY`              | ⚠️ بدون آن تحقیق **واقعی** نیست. pipeline می‌تواند brief بسازد ولی **منبع واقعی ندارد** — و بند ۸ پرامپت همین را ممنوع می‌کند |
| ۲   | دیدن `new/page.tsx`           | باید بدانم فرم فعلی چه فیلدهایی دارد تا «پر کردنش» واقعی باشد نه حدس                                                          |
| ۳   | تصمیم: provider پیکربندی شده؟ | `AiSettingsService.isEnabled` — اگر خاموش باشد، دکمه باید پیام درست بدهد                                                      |

⚠️ **بدون `TAVILY_API_KEY` می‌توانم فازهای ۱ و ۳ تا ۵ را بنویسم** (schema و
generation)، ولی **فاز ۲ و ۷ ناقص می‌مانند** و باید صریح بگویم که تحقیق واقعی
نیست.

کدام را اول می‌بینم — `new/page.tsx`، یا کلید را ست می‌کنید؟
