// apps/web/app/[lang]/(dashboard)/timesheets/page.tsx
//
// Thin by design: metadata, then the shared container. Every query, every
// piece of state and every rule lives in `@hisabche/ui`, so desktop mounts
// exactly this screen from its own router without a second implementation.
import { TimesheetsContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'کارکرد و صورتحساب',
  af: 'کارکرد و صورتحساب',
  en: 'Timesheets',
}

const keywords: Record<string, string[]> = {
  fa: ['کارکرد', 'ثبت زمان', 'صورتحساب پروژه', 'سودآوری پروژه'],
  af: ['کارکرد', 'ثبت زمان', 'صورتحساب پروژه', 'سودآوری پروژه'],
  en: ['timesheet', 'time tracking', 'project billing', 'profitability'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    keywords: keywords[lang] || keywords['fa'],
  }
}

export default function TimesheetsPage() {
  return <TimesheetsContainer />
}
