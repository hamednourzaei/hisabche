// apps/web/app/sitemap.ts
import { type MetadataRoute } from "next";

const BASE_URL = "https://www.hisabche.com";

// Only public pages — no authenticated routes
const routes = [
  { path: "" },
  { path: "/pricing" },
  { path: "/login" },
  { path: "/signup" },
  { path: "/forgot-password" },
  { path: "/onboarding" },
  { path: "/accept-invite" },
];

const locales = ["fa-IR", "fa-AF", "en"];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const route of routes) {
    // Use a per‑route timestamp if you track changes; otherwise omit lastModified
    const now = new Date().toISOString();

    for (const locale of locales) {
      const path = locale === "fa-IR" ? route.path : `/${locale}${route.path}`;

      entries.push({
        url: `${BASE_URL}${path}`,
        lastModified: now,
        alternates: {
          languages: {
            "fa-IR": `${BASE_URL}${route.path}`,
            "fa-AF": `${BASE_URL}/fa-AF${route.path}`,
            "en": `${BASE_URL}/en${route.path}`,
          },
        },
      });
    }
  }

  return entries;
}