'use client'

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl'
import type { ReactNode } from 'react'

export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: string
  messages: AbstractIntlMessages
  children: ReactNode
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={() => {}}
      getMessageFallback={({ key, namespace }) => {
        return namespace ? `${namespace}.${key}` : key
      }}
    >
      {children}
    </NextIntlClientProvider>
  )
}
