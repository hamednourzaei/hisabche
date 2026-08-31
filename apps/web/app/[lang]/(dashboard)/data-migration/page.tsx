// apps/web/app/[lang]/(dashboard)/data-migration/page.tsx
//
// Thin by design: metadata, then the shared container. The wizard, the parsing
// decisions and every piece of state live in `@hisabche/ui`, so desktop mounts
// exactly this screen from its own router without a second implementation.
import { DataMigrationContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'انتقال داده',
  af: 'انتقال داده',
  en: 'Data migration',
}

const keywords: Record<string, string[]> = {
  fa: ['انتقال داده', 'ورود اطلاعات', 'وارد کردن مشتریان', 'وارد کردن کالا', 'CSV'],
  af: ['انتقال داده', 'ورود اطلاعات', 'وارد کردن مشتریان', 'وارد کردن کالا', 'CSV'],
  en: ['data migration', 'import', 'import customers', 'import products', 'CSV'],
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    keywords: keywords[lang] || keywords['fa'],
  }
}

export default function DataMigrationPage() {
  return <DataMigrationContainer />
}
