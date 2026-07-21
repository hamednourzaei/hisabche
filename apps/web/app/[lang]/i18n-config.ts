// apps/web/app/i18n-config.ts
export const locales = ['fa', 'AF', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fa';

export const localeMeta: Record<Locale, {
  name: string;
  nativeName: string;
  direction: 'rtl' | 'ltr';
  flag: string;
}> = {
  'fa': { name: 'Persian', nativeName: 'فارسی', direction: 'rtl', flag: '🇮🇷' },
  'AF': { name: 'Dari', nativeName: 'دری', direction: 'rtl', flag: '🇦🇫' },
  'en': { name: 'English', nativeName: 'English', direction: 'ltr', flag: '🇬🇧' },
};