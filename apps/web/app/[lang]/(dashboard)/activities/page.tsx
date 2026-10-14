// apps/web/app/[lang]/(dashboard)/activities/page.tsx
import { ActivitiesPage } from '@hisabche/ui'

// Without its own title the tab read «داشبورد» — the group's default (live audit #17).
const titles: Record<string, string> = { fa: 'رخدادها', af: 'رخدادها', en: 'Activity' }

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return { title: titles[lang] || titles['fa'], robots: { index: false, follow: false } }
}

export default function Page() {
  return (
    <div className="p-4 md:p-6">
      <ActivitiesPage />
    </div>
  )
}
