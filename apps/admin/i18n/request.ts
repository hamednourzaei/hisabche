// apps/admin/i18n/request.ts
import { getRequestConfig } from 'next-intl/server'
import { locales, defaultLocale, type Locale } from '../app/[lang]/i18n-config'

const loaders: Record<Locale, () => Promise<{ default: unknown }>> = {
  fa: () => import('@hisabche/i18n/messages/fa/common.json'),
  en: () => import('@hisabche/i18n/messages/en/common.json'),
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale: Locale = locales.includes(requested as Locale)
    ? (requested as Locale)
    : defaultLocale

  let messages: Record<string, unknown>
  try {
    messages = (await loaders[locale]()).default as Record<string, unknown>
  } catch (err) {
    console.error(
      `[admin-i18n] Failed to load messages for locale "${locale}", falling back to "${defaultLocale}"`,
      err,
    )
    messages = (await loaders[defaultLocale]()).default as Record<string, unknown>
  }

  return {
    locale,
    messages,
    onError() {},
    getMessageFallback({ key, namespace }) {
      return namespace ? `${namespace}.${key}` : key
    },
  }
})
