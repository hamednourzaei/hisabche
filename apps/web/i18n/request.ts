// apps/web/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from '../app/[lang]/i18n-config';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = locales.includes(requested as Locale)
    ? (requested as Locale)
    : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}/common.json`)).default,
  };
});
