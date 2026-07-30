// apps/web/app/[lang]/legal/legal-metadata.ts
import type { Metadata } from "next";

type Locale = "fa" | "af" | "en";

const OG_LOCALE: Record<Locale, string> = { fa: "fa_IR", af: "fa_AF", en: "en_US" };

function resolveLocale(lang: string): Locale {
  return lang === "af" || lang === "en" ? lang : "fa";
}

/**
 * Shared Metadata builder for every /legal/* (and other standalone public)
 * page — keeps canonical/OpenGraph/Twitter/robots consistent with the
 * convention already established in apps/web/app/[lang]/page.tsx, instead of
 * every legal sub-page re-deriving it ad hoc.
 */
export function buildLegalMetadata({
  lang,
  path,
  title,
  description,
}: {
  lang: string;
  /** route path under the locale, e.g. "/legal/privacy" or "/contact" */
  path: string;
  // Callers typically derive these via `titles[lang] || titles.fa` against a
  // Record<string, string> — with noUncheckedIndexedAccess that's `string |
  // undefined`, even though a default is always present at runtime.
  title: string | undefined;
  description: string | undefined;
}): Metadata {
  const locale = resolveLocale(lang);
  const canonical = locale === "fa" ? path : `/${locale}${path}`;
  const url = `https://www.hisabche.com${canonical}`;
  const safeTitle = title ?? "";
  const safeDescription = description ?? "";

  return {
    title: safeTitle,
    description: safeDescription,
    alternates: { canonical },
    openGraph: {
      title: safeTitle,
      description: safeDescription,
      url,
      siteName: locale === "en" ? "Hisabche" : "حسابچه",
      locale: OG_LOCALE[locale],
      type: "website",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Hisabche" }],
    },
    twitter: {
      card: "summary_large_image",
      title: safeTitle,
      description: safeDescription,
      images: ["/og-image.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
    },
  };
}
