import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert'

console.log('--- APPLYING QA REPAIRS ---')

// 1. ApprovalsView showHeader
{
  const filePath = 'packages/ui/src/components/ui/workflow/approvals-view.tsx'
  let code = fs.readFileSync(filePath, 'utf8')

  const target1 = '  onDefineWorkflow: () => void\n}'
  const repl1 = '  onDefineWorkflow: () => void\n  showHeader?: boolean | undefined\n}'
  assert(code.includes(target1), 'ApprovalsViewProps target not found')
  code = code.replace(target1, repl1)

  const target2 = '  onDefineWorkflow,\n}: ApprovalsViewProps) {'
  const repl2 = '  onDefineWorkflow,\n  showHeader = true,\n}: ApprovalsViewProps) {'
  assert(code.includes(target2), 'ApprovalsView params target not found')
  code = code.replace(target2, repl2)

  const target3 = `      <CapabilityHeader
        title={t('nav.approvals', 'در انتظار تأیید شما')}
        description={t('nav.approvals_description', 'درخواست‌هایی که باید تأیید یا رد کنید')}
        action={
          <ActionButton variant="quiet" onClick={onRetry} disabled={isLoading}>
            {t('common.refresh', 'تازه‌سازی')}
          </ActionButton>
        }
      />`
  const repl3 = `      {showHeader && (
        <CapabilityHeader
          title={t('nav.approvals', 'در انتظار تأیید شما')}
          description={t('nav.approvals_description', 'درخواست‌هایی که باید تأیید یا رد کنید')}
          action={
            <ActionButton variant="quiet" onClick={onRetry} disabled={isLoading}>
              {t('common.refresh', 'تازه‌سازی')}
            </ActionButton>
          }
        />
      )}`
  assert(code.includes(target3), 'ApprovalsView CapabilityHeader target not found')
  code = code.replace(target3, repl3)

  fs.writeFileSync(filePath, code, 'utf8')
  console.log('✓ Updated packages/ui/src/components/ui/workflow/approvals-view.tsx')
}

// 2. ApprovalsContainer showHeader
{
  const filePath = 'packages/ui/src/components/ui/workflow/containers/approvals-container.tsx'
  let code = fs.readFileSync(filePath, 'utf8')

  const target1 = `export const ApprovalsContainer = memo(function ApprovalsContainer({
  onDefineWorkflow,
}: {
  /** Where «تعریف گردش‌کار» goes. Absent = the workflows page, as before. */
  onDefineWorkflow?: (() => void) | undefined
}) {`
  const repl1 = `export const ApprovalsContainer = memo(function ApprovalsContainer({
  onDefineWorkflow,
  showHeader = true,
}: {
  /** Where «تعریف گردش‌کار» goes. Absent = the workflows page, as before. */
  onDefineWorkflow?: (() => void) | undefined
  showHeader?: boolean | undefined
}) {`
  assert(code.includes(target1), 'ApprovalsContainer target1 not found')
  code = code.replace(target1, repl1)

  const target2 = `<ApprovalsContainerContent onDefineWorkflow={onDefineWorkflow} t={t} />`
  const repl2 = `<ApprovalsContainerContent onDefineWorkflow={onDefineWorkflow} showHeader={showHeader} t={t} />`
  assert(code.includes(target2), 'ApprovalsContainer target2 not found')
  code = code.replace(target2, repl2)

  const target3 = `const ApprovalsContainerContent = memo(function ApprovalsContainerContent({
  onDefineWorkflow,
  t,
}: {
  onDefineWorkflow?: (() => void) | undefined
  t: (key: string, fallback?: string) => string
}) {`
  const repl3 = `const ApprovalsContainerContent = memo(function ApprovalsContainerContent({
  onDefineWorkflow,
  showHeader,
  t,
}: {
  onDefineWorkflow?: (() => void) | undefined
  showHeader?: boolean | undefined
  t: (key: string, fallback?: string) => string
}) {`
  assert(code.includes(target3), 'ApprovalsContainer target3 not found')
  code = code.replace(target3, repl3)

  const target4 = `      onDefineWorkflow={onDefineWorkflow ?? (() => push('/approvals?tab=workflows'))}
    />`
  const repl4 = `      onDefineWorkflow={onDefineWorkflow ?? (() => push('/approvals?tab=workflows'))}
      showHeader={showHeader}
    />`
  assert(code.includes(target4), 'ApprovalsContainer target4 not found')
  code = code.replace(target4, repl4)

  fs.writeFileSync(filePath, code, 'utf8')
  console.log('✓ Updated packages/ui/src/components/ui/workflow/containers/approvals-container.tsx')
}

// 3. GovernanceHubContainer
{
  const filePath =
    'packages/ui/src/components/ui/governance/containers/governance-hub-container.tsx'
  let code = fs.readFileSync(filePath, 'utf8')

  const target = `{active === 'approvals' ? <ApprovalsContainer /> : null}`
  const repl = `{active === 'approvals' ? <ApprovalsContainer showHeader={false} /> : null}`
  assert(code.includes(target), 'GovernanceHubContainer target not found')
  code = code.replace(target, repl)

  fs.writeFileSync(filePath, code, 'utf8')
  console.log(
    '✓ Updated packages/ui/src/components/ui/governance/containers/governance-hub-container.tsx',
  )
}

// 4. InvoiceBuilderMobile H1 fix
{
  const filePath = 'packages/ui/src/components/ui/invoice-builder/mobile/invoice-builder-mobile.tsx'
  let code = fs.readFileSync(filePath, 'utf8')

  const target = `<h1 className="min-w-0 flex-1 truncate text-base font-bold text-[hsl(var(--fg-primary))]">
          {t('invoiceBuilder.new', 'فاکتور جدید')}
        </h1>`
  const repl = `<p role="heading" aria-level={1} className="min-w-0 flex-1 truncate text-base font-bold text-[hsl(var(--fg-primary))]">
          {t('invoiceBuilder.new', 'فاکتور جدید')}
        </p>`
  assert(code.includes(target), 'InvoiceBuilderMobile target not found')
  code = code.replace(target, repl)

  fs.writeFileSync(filePath, code, 'utf8')
  console.log(
    '✓ Updated packages/ui/src/components/ui/invoice-builder/mobile/invoice-builder-mobile.tsx',
  )
}

// 5. TeamAndPayrollContainer branches cold-load fix
{
  const filePath =
    'packages/ui/src/components/ui/team-and-payroll/containers/team-and-payroll-container.tsx'
  let code = fs.readFileSync(filePath, 'utf8')

  const target = `      branches={branches}
      permissionProfiles={permissionProfiles}`
  const repl = `      branches={branches.length > 0 ? branches : (branchTree as unknown as typeof branches)}
      permissionProfiles={permissionProfiles}`
  assert(code.includes(target), 'TeamAndPayrollContainer target not found')
  code = code.replace(target, repl)

  fs.writeFileSync(filePath, code, 'utf8')
  console.log(
    '✓ Updated packages/ui/src/components/ui/team-and-payroll/containers/team-and-payroll-container.tsx',
  )
}

// 6. Professional i18n copy for storefront / orders (no internal ops notes)
{
  const locales = [
    {
      lang: 'en',
      file: 'packages/i18n/messages/en/common.json',
      ordersNotConfigured:
        'The orders service is currently unavailable or undergoing setup. Please contact support if this persists.',
      storefrontNotConfigured:
        'The website storefront service is currently unavailable or undergoing setup. Please contact support if this persists.',
    },
    {
      lang: 'fa',
      file: 'packages/i18n/messages/fa/common.json',
      ordersNotConfigured:
        'بخش سفارش‌ها در حال حاضر در دسترس نیست یا در مرحله راه‌اندازی قرار دارد. در صورت نیاز با پشتیبانی تماس بگیرید.',
      storefrontNotConfigured:
        'قابلیت فروشگاه وب‌سایت در حال حاضر در دسترس نیست یا در مرحله راه‌اندازی قرار دارد. در صورت نیاز با پشتیبانی تماس بگیرید.',
    },
    {
      lang: 'af',
      file: 'packages/i18n/messages/af/common.json',
      ordersNotConfigured:
        'بخش سفارش‌ها در حال حاضر در دسترس نیست یا در مرحله راه‌اندازی قرار دارد. در صورت ضرورت با پشتیبانی به تماس شوید.',
      storefrontNotConfigured:
        'قابلیت دوکان وب‌سایت در حال حاضر در دسترس نیست یا در مرحله راه‌اندازی قرار دارد. در صورت ضرورت با پشتیبانی به تماس شوید.',
    },
  ]

  for (const loc of locales) {
    const raw = fs.readFileSync(loc.file, 'utf8')
    const json = JSON.parse(raw)
    if (json.orders) {
      json.orders.notConfigured = loc.ordersNotConfigured
    }
    if (json.storefront) {
      json.storefront.notConfigured = loc.storefrontNotConfigured
    }
    fs.writeFileSync(loc.file, JSON.stringify(json, null, 2) + '\n', 'utf8')
    console.log(`✓ Updated ${loc.file}`)
  }
}

// 7. Add missing apps/web/app/[lang]/(dashboard)/audit/page.tsx
{
  const auditPageDir = path.resolve('apps/web/app/[lang]/(dashboard)/audit')
  if (!fs.existsSync(auditPageDir)) {
    fs.mkdirSync(auditPageDir, { recursive: true })
  }
  const auditPagePath = path.join(auditPageDir, 'page.tsx')
  const content = `// apps/web/app/[lang]/(dashboard)/audit/page.tsx
import { AuditContainer } from '@hisabche/ui'

const titles: Record<string, string> = {
  fa: 'سابقه تغییرات',
  af: 'سابقه تغییرات',
  en: 'Audit Log',
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return {
    title: titles[lang] || titles.fa,
    robots: { index: false, follow: false },
  }
}

export default function AuditPage() {
  return <AuditContainer />
}
`
  fs.writeFileSync(auditPagePath, content, 'utf8')
  console.log(`✓ Created ${auditPagePath}`)
}

console.log('--- ALL QA REPAIRS COMPLETED SUCCESSFULLY ---')
