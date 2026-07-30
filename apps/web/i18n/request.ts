// apps/web/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { IntlErrorCode } from 'next-intl';
import { locales, defaultLocale, type Locale } from '../app/[lang]/i18n-config';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = locales.includes(requested as Locale)
    ? (requested as Locale)
    : defaultLocale;

  // ✅ FIX: قبلاً اگر بارگذاری فایل پیام یک locale به هر دلیلی (مثلاً
  // ناهماهنگی حروف کوچک/بزرگ مسیر فایل بین ویندوز dev و سرور لینوکس
  // production) شکست می‌خورد، کل route با ۵۰۰ کرش می‌کرد. حالا اگر
  // بارگذاری locale درخواستی شکست بخورد، به defaultLocale برمی‌گردیم
  // به‌جای کرش کردن کل صفحه.
  let messages: Record<string, unknown>;
  try {
    messages = (await import(`../messages/${locale}/common.json`)).default;
  } catch (err) {
    console.error(`[i18n] Failed to load messages for locale "${locale}", falling back to "${defaultLocale}"`, err);
    messages = (await import(`../messages/${defaultLocale}/common.json`)).default;
  }

  return {
    locale,
    messages,
    // ✅ FIX: کلید ترجمه‌ی گمشده (مسیر اشتباه در کد یا محتوای ناقص) قبلاً
    // در سرور Error پرتاب می‌کرد (که برای بعضی مسیرها باعث ۵۰۰ می‌شد) و در
    // کلاینت انبوهی از console.error تولید می‌کرد. حالا فقط لاگ می‌کنیم و
    // یک متن برگشتی امن نمایش می‌دهیم؛ رندر هیچ‌وقت کرش نمی‌کند.
    onError(error) {
      // ✅ خیلی از کامپوننت‌ها از wrapper محلی safeT/st استفاده می‌کنند که
      // t(key) خام next-intl را صدا می‌زند و اگر کلید نبود، خودش fallback
      // درست را نمایش می‌دهد — یعنی MISSING_MESSAGE در این موارد قبلاً
      // در سطح UI هندل شده و صرفاً نویز کنسول است، نه باگ واقعی.
      if (error.code === IntlErrorCode.MISSING_MESSAGE) return;
      console.error(error);
    },
    getMessageFallback({ key, namespace }) {
      const path = namespace ? `${namespace}.${key}` : key;
      return path.split('.').pop() ?? path;
    },
  };
});
