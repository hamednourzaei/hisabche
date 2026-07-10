// apps/web/app/sitemap.ts
import { type MetadataRoute } from 'next';

const BASE_URL = 'https://www.hisabche.com';
const now = new Date().toISOString();

// All static routes (without locale prefix)
const routes = [
  { path: '', changeFrequency: 'weekly' as const, priority: 1.0 },
  { path: '/dashboard', changeFrequency: 'daily' as const, priority: 0.9 },
  { path: '/invoices', changeFrequency: 'daily' as const, priority: 0.9 },
  { path: '/customers', changeFrequency: 'daily' as const, priority: 0.9 },
  { path: '/warehouse', changeFrequency: 'daily' as const, priority: 0.9 },
  { path: '/human-resources', changeFrequency: 'daily' as const, priority: 0.8 },
  { path: '/projects', changeFrequency: 'daily' as const, priority: 0.8 },
  { path: '/audit', changeFrequency: 'weekly' as const, priority: 0.7 },
  { path: '/permissions', changeFrequency: 'weekly' as const, priority: 0.7 },
  { path: '/workspace', changeFrequency: 'weekly' as const, priority: 0.7 },
  { path: '/settings', changeFrequency: 'monthly' as const, priority: 0.5 },
  { path: '/sync-center', changeFrequency: 'weekly' as const, priority: 0.6 },
  { path: '/quick-invoice', changeFrequency: 'weekly' as const, priority: 0.8 },
  { path: '/onboarding', changeFrequency: 'monthly' as const, priority: 0.6 },
  { path: '/accept-invite', changeFrequency: 'monthly' as const, priority: 0.4 },
  { path: '/pricing', changeFrequency: 'weekly' as const, priority: 0.7 },
  { path: '/login', changeFrequency: 'yearly' as const, priority: 0.3 },
  { path: '/signup', changeFrequency: 'yearly' as const, priority: 0.3 },
];

const locales = ['fa-IR', 'fa-AF', 'en'];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const route of routes) {
    for (const locale of locales) {
      const path = locale === 'fa-IR' ? route.path : `/${locale}${route.path}`;
      
      entries.push({
        url: `${BASE_URL}${path}`,
        lastModified: now,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: {
          languages: {
            'fa-IR': `${BASE_URL}${route.path}`,
            'fa-AF': `${BASE_URL}/fa-AF${route.path}`,
            'en': `${BASE_URL}/en${route.path}`,
          },
        },
      });
    }
  }

  return entries;
}