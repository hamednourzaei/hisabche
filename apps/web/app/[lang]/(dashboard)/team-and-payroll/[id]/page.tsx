// apps/web/app/[lang]/(dashboard)/team-and-payroll/[id]/page.tsx
//
// G1 — the CANONICAL employee detail route. Moved here from
// /human-resources/[id], which now redirects into this prefix so the whole
// people domain lives under one path.
import { EmployeeDetailContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'جزئیات کارمند',
  af: 'جزئیات کارمند',
  en: 'Employee Details',
}

const descriptions: Record<string, string> = {
  fa: 'مشاهده و ویرایش اطلاعات کارمند، حقوق، حضور و غیاب، مرخصی‌ها و سوابق کاری در حسابچه.',
  af: 'مشاهده و ویرایش اطلاعات کارمند، حقوق، حضور و غیاب، مرخصی‌ها و سوابق کاری در حسابچه.',
  en: 'View and edit employee info, salary, attendance, leaves and work history in Hisabche.',
}

const keywords: Record<string, string[]> = {
  fa: [
    'جزئیات کارمند',
    'اطلاعات کارمند',
    'حقوق کارمند',
    'حضور و غیاب',
    'مرخصی کارمند',
    'ویرایش کارمند',
    'سوابق کاری',
    'حسابچه',
    'مدیریت کارمند',
    'پرسنل',
  ],
  af: [
    'جزئیات کارمند',
    'اطلاعات کارمند',
    'حقوق کارمند',
    'حضور و غیاب',
    'مرخصی کارمند',
    'ویرایش کارمند',
    'سوابق کاری',
    'حسابچه',
    'مدیریت کارمند',
    'پرسنل',
  ],
  en: [
    'employee details',
    'employee info',
    'employee salary',
    'attendance',
    'employee leave',
    'edit employee',
    'work history',
    'hisabche',
    'employee management',
    'personnel',
  ],
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>
}) {
  const { lang } = await params
  return {
    title: titles[lang] || titles['fa'],
    description: descriptions[lang] || descriptions['fa'],
    keywords: keywords[lang] || keywords['fa'],
  }
}

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EmployeeDetailContainer id={id} />
}
