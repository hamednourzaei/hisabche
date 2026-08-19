// apps/web/app/i18n-config.ts
export const locales = ['fa', 'af', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'fa'

export const localeMeta: Record<
  Locale,
  {
    name: string
    nativeName: string
    direction: 'rtl' | 'ltr'
    flag: string
  }
> = {
  fa: { name: 'Persian', nativeName: 'فارسی', direction: 'rtl', flag: '🇮🇷' },
  af: { name: 'Dari', nativeName: 'دری', direction: 'rtl', flag: '🇦🇫' },
  en: { name: 'English', nativeName: 'English', direction: 'ltr', flag: '🇬🇧' },
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEO / locale helpers — single source of truth
   ═══════════════════════════════════════════════════════════════════════════
   These exist because the same three derivations were previously re-implemented
   (and got out of sync) in layout.tsx, page.tsx, legal-metadata.ts and
   sitemap.ts:

   1. URL prefix. proxy.ts uses `localePrefix: 'always'`, so EVERY locale —
      including the default `fa` — is served under a prefix. Code that assumed
      `fa` was served unprefixed emitted canonicals and sitemap URLs pointing at
      307 redirects.
   2. BCP-47 tag. The route segment `af` is NOT a valid language tag for Dari —
      `af` is Afrikaans. Dari is `fa-AF`. This is what belongs in `<html lang>`,
      `hreflang` and schema.org `inLanguage`.
   3. Direction, which was hardcoded in the layout rather than read from
      `localeMeta` above.
*/

export const SITE_URL = 'https://www.hisabche.com'

/** Valid BCP-47 language tag for a locale segment. `af` (Afrikaans) ≠ Dari. */
export const localeToBcp47: Record<Locale, string> = {
  fa: 'fa',
  af: 'fa-AF',
  en: 'en',
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

/** Narrow an unvalidated route segment to a Locale, falling back to the default. */
export function resolveLocale(lang: string): Locale {
  return isLocale(lang) ? lang : defaultLocale
}

/**
 * Absolute path for a route under a locale. `path` is the route beneath the
 * locale segment ("" for the home page, "/legal/privacy", …).
 */
export function localePath(lang: string, path = ''): string {
  return `/${resolveLocale(lang)}${path}`
}

/** Absolute, canonical URL — always locale-prefixed. */
export function localeUrl(lang: string, path = ''): string {
  return `${SITE_URL}${localePath(lang, path)}`
}

/**
 * `alternates.languages` for a given route, so each page's hreflang points at
 * its own equivalent rather than at the home page.
 */
export function languageAlternates(path = ''): Record<string, string> {
  return {
    fa: localePath('fa', path),
    'fa-AF': localePath('af', path),
    en: localePath('en', path),
    'x-default': localePath(defaultLocale, path),
  }
}
