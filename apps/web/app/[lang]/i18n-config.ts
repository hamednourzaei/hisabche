// apps/web/app/i18n-config.ts
export const locales = ['fa-IR', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fa-IR';

export const localeMeta: Record<Locale, {
  name: string;
  nativeName: string;
  direction: 'rtl' | 'ltr';
  flag: string;
}> = {
  'fa-IR': { name: 'Persian', nativeName: 'فارسی', direction: 'rtl', flag: '🇮🇷' },
  'en': { name: 'English', nativeName: 'English', direction: 'ltr', flag: '🇬🇧' },
};