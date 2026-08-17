export const locales = ['fa', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'fa'

export const localeMeta: Record<
  Locale,
  {
    name: string
    nativeName: string
    direction: 'rtl' | 'ltr'
  }
> = {
  fa: { name: 'Persian', nativeName: 'فارسی', direction: 'rtl' },
  en: { name: 'English', nativeName: 'English', direction: 'ltr' },
}
