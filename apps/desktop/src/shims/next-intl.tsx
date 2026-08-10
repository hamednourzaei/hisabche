// ============================================
// Shim: maps the slice of next-intl that `@hisabche/ui` uses onto the desktop
// i18next instance.
//
// The shared UI only ever reaches for `useTranslations` and `useLocale`. Both
// read the same `packages/i18n/messages` catalogs the web app renders from, so
// a screen lifted into desktop shows identical copy without a second catalog.
// ============================================

import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import {
  formatMessage,
  getMessages,
  resolveMessage,
  toMessageLocale,
  type MessageCatalog,
  type MessageLocale,
} from '@hisabche/i18n/messages'

import { i18n } from '@/shared/i18n'

type Values = Record<string, string | number | undefined>

export interface Translator {
  (key: string, values?: Values): string
  /** next-intl's escape hatch — returns the key itself when nothing matches. */
  raw(key: string): unknown
  rich(key: string, values?: Values): string
}

const LocaleContext = createContext<MessageLocale | null>(null)

/**
 * Subscribe to i18next's language so a language switch re-renders shared UI.
 * `useSyncExternalStore` rather than state + effect: the language can change
 * before React mounts (startup resolves it from storage) and this reads the
 * live value on every render without a tearing window.
 */
function useCurrentLocale(): MessageLocale {
  const override = useContext(LocaleContext)

  const language = useSyncExternalStore(
    (onChange) => {
      i18n.on('languageChanged', onChange)
      return () => i18n.off('languageChanged', onChange)
    },
    () => i18n.language,
    () => i18n.language,
  )

  return override ?? toMessageLocale(language)
}

export function useLocale(): string {
  return useCurrentLocale()
}

/**
 * `useTranslations(namespace?)` — keys resolve relative to the namespace, the
 * same as on web.
 *
 * A miss returns the full dotted path. That is deliberate: components across
 * `packages/ui` wrap this in `safeT`/`st` helpers that compare the result to
 * the key to decide whether to show their own Persian fallback. Returning an
 * empty string or the bare last segment would defeat those wrappers.
 */
export function useTranslations(namespace?: string): Translator {
  const locale = useCurrentLocale()

  return useMemo(() => {
    const catalog: MessageCatalog = getMessages(locale)
    const prefix = namespace ? `${namespace}.` : ''

    const translate = (key: string, values?: Values): string => {
      const path = `${prefix}${key}`
      const message = resolveMessage(catalog, path)
      return message === undefined ? path : formatMessage(message, values)
    }

    const t = translate as Translator
    t.raw = (key: string) => resolveMessage(catalog, `${prefix}${key}`) ?? `${prefix}${key}`
    t.rich = translate

    return t
  }, [locale, namespace])
}

/**
 * Present so shared components that expect a provider higher in the tree keep
 * working. Desktop drives the locale from i18next, so `locale` is optional and
 * only used to pin a subtree (invoice print previews render in the customer's
 * language, not the operator's).
 */
export function NextIntlClientProvider({
  locale,
  children,
}: {
  locale?: string
  messages?: unknown
  children: React.ReactNode
}) {
  const value = useMemo(() => (locale ? toMessageLocale(locale) : null), [locale])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useMessages(): MessageCatalog {
  return getMessages(useCurrentLocale())
}

/** next-intl exposes formatters through `useFormatter`; UI uses it for dates. */
export function useFormatter() {
  const locale = useCurrentLocale()

  return useMemo(
    () => ({
      dateTime: (date: Date, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, options).format(date),
      number: (value: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(locale, options).format(value),
    }),
    [locale],
  )
}
