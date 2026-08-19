import type { Metadata } from 'next'
import DashboardLayout from './dashboard-layout'

/* ═══════════════════════════════════════════════════════════════════════════
   Authenticated dashboard group.

   This layout previously declared a title, a public-facing marketing
   description and a keyword list, but NO `robots` — so every route in the group
   inherited `robots: { index: true, follow: true }` from the root layout. Twelve
   routes (accounting, activities, billing, crm, dashboard, human-resources,
   human-resources/[id], manufacturing, permissions, purchasing, warehouse,
   workflow-templates) set no robots of their own and were therefore explicitly
   advertised as indexable, while thirteen sibling routes did set
   `index: false` — the intent was clear, the coverage was not.

   Declaring noindex here makes it structural rather than something each new
   dashboard page has to remember. Next merges metadata field-by-field, so a
   child that sets its own `robots` still replaces this wholesale; every one of
   those children sets `index: false`, so the group is now noindex either way.

   The SEO description/keywords are gone: they targeted public search terms
   ("حسابداری آنلاین", "accounting") on an authenticated surface, which is
   exactly the content that should not be competing in search.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  return {
    title: {
      default: lang === 'en' ? 'Dashboard' : 'داشبورد',
      template: lang === 'en' ? '%s | Hisabche' : '%s | حسابچه',
    },
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false, noimageindex: true },
    },
  }
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>
}
