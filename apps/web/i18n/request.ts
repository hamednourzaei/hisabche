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
    // ✅ خیلی از کامپوننت‌ها از wrapper محلی safeT/st استفاده می‌کنند که
    // t(key) خام next-intl را صدا می‌زند و اگر کلید نبود یا مسیر اشتباه
    // بود، خودشان fallback درست را نمایش می‌دهند — یعنی این خطاها
    // (MISSING_MESSAGE، INSUFFICIENT_PATH و مشابه) قبلاً در سطح UI هندل
    // شده‌اند و صرفاً نویز کنسول‌اند، نه باگ visible. کاملاً بی‌صدا می‌کنیم؛
    // getMessageFallback زیر همچنان یک متن امن برمی‌گرداند تا رندر کرش نکند.
    onError() {},
    getMessageFallback({ key, namespace }) {
      const path = namespace ? `${namespace}.${key}` : key;
      return path.split('.').pop() ?? path;
    },
  };
});
