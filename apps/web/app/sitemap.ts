// apps/web/app/sitemap.ts
import { type MetadataRoute } from "next";

const BASE_URL = "https://www.hisabche.com";

// Only public, indexable pages. `/pricing`, `/login`, `/signup`, `/forgot-password`,
// `/onboarding` and `/accept-invite` are intentionally excluded: `/pricing` has no
// route (pricing is a section on the homepage, see PricingScene in the landing page),
// and the rest carry `robots: { index: false }` in their own metadata — listing
// noindex or non-existent URLs in the sitemap wastes crawl budget and can trigger
// Search Console "Submitted URL marked noindex" / 404 errors.
const routes = [
  { path: "" },
  { path: "/about" },
  { path: "/contact" },
  { path: "/legal/terms" },
  { path: "/legal/privacy" },
  { path: "/legal/cookies" },
  { path: "/legal/disclaimer" },
  { path: "/legal/refund" },
  { path: "/legal/accessibility" },
  { path: "/legal/security" },
  { path: "/legal/data-deletion" },
  { path: "/legal/gdpr" },
  { path: "/legal/copyright" },
];

// Must match the actual locale segments served by app/[lang] (see i18n-config.ts):
// "fa" is the default locale and is served unprefixed at "/", "af" and "en" are prefixed.
const locales = ["fa", "af", "en"];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date().toISOString();

  for (const route of routes) {
    for (const locale of locales) {
      const path = locale === "fa" ? route.path : `/${locale}${route.path}`;

      entries.push({
        url: `${BASE_URL}${path}`,
        lastModified: now,
        alternates: {
          languages: {
            "fa": `${BASE_URL}/fa${route.path}`,
            "fa-AF": `${BASE_URL}/af${route.path}`,
            "en": `${BASE_URL}/en${route.path}`,
          },
        },
      });
    }
  }

  return entries;
}