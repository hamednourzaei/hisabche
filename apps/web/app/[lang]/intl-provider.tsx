"use client";

// apps/web/app/[lang]/intl-provider.tsx
//
// ✅ FIX: NextIntlClientProvider's onError/getMessageFallback must be plain
// functions, but the RSC boundary forbids passing function props FROM a
// Server Component (apps/web/app/[lang]/layout.tsx) directly INTO a Client
// Component — Next.js throws "Functions cannot be passed directly to Client
// Components" and the whole provider (and everything under it) fails to
// render. Defining the functions HERE, inside an actual "use client" module,
// keeps them entirely on the client side — the server layout only ever
// passes serializable props (locale, messages, children) into this wrapper.
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";

export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={() => {
        // این کامپوننت‌ها از wrapper محلی safeT/st استفاده می‌کنند که خودشان
        // fallback درست را نمایش می‌دهند — این خطا فقط نویز کنسول است.
      }}
      getMessageFallback={({ key, namespace }) => {
        return namespace ? `${namespace}.${key}` : key;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
