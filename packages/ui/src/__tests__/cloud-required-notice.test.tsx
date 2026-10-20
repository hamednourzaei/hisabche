import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CloudRequiredNotice } from '../components/ui/cloud-required-notice'

// Mock next-intl to return the translation key path or fallback
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => {
    return (key: string) => (ns ? `${ns}.${key}` : key)
  },
  useLocale: () => 'fa',
}))

afterEach(cleanup)

describe('CloudRequiredNotice Component', () => {
  it('renders card variant by default with alert role and default translations', () => {
    render(<CloudRequiredNotice />)

    const alert = screen.getByRole('alert')
    expect(alert).toBeTruthy()
    expect(alert.getAttribute('data-cloud-required')).toBe('card')

    expect(screen.getByText('offline.cloudRequired.title')).toBeTruthy()
    expect(screen.getByText('offline.cloudRequired.badge')).toBeTruthy()
    expect(screen.getByText('offline.cloudRequired.description')).toBeTruthy()
    expect(screen.getByText('offline.cloudRequired.whyDefault')).toBeTruthy()
    expect(screen.getByText('offline.cloudRequired.whatToDoDefault')).toBeTruthy()
    expect(screen.getByText('offline.cloudRequired.dataSafe')).toBeTruthy()
  })

  it('respects custom title, badgeText, description, why, and whatToDo overrides', () => {
    render(
      <CloudRequiredNotice
        title="فرمول ساخت (BOM)"
        badgeText="فقط نسخه ابری"
        description="فرمول‌های ساخت نیازمند همگام‌سازی با پایگاه داده مرکزی هستند."
        why="موتور محاسباتی BOM در ویرایش اول روی دستگاه نصب نیست."
        whatToDo="جهت ویرایش یا ثبت فرمول جدید، به وب‌سایت حسابچه مراجعه فرمایید."
      />,
    )

    expect(screen.getByText('فرمول ساخت (BOM)')).toBeTruthy()
    expect(screen.getByText('فقط نسخه ابری')).toBeTruthy()
    expect(
      screen.getByText('فرمول‌های ساخت نیازمند همگام‌سازی با پایگاه داده مرکزی هستند.'),
    ).toBeTruthy()
    expect(screen.getByText('موتور محاسباتی BOM در ویرایش اول روی دستگاه نصب نیست.')).toBeTruthy()
    expect(
      screen.getByText('جهت ویرایش یا ثبت فرمول جدید، به وب‌سایت حسابچه مراجعه فرمایید.'),
    ).toBeTruthy()
  })

  it('renders inline variant with compact banner layout and dismiss button', () => {
    const onDismiss = vi.fn()
    render(
      <CloudRequiredNotice
        variant="inline"
        title="هوش مصنوعی"
        description="دسترسی به سرور ابری قطع است."
        onDismiss={onDismiss}
      />,
    )

    const alert = screen.getByRole('alert')
    expect(alert.getAttribute('data-cloud-required')).toBe('inline')
    expect(screen.getByText('هوش مصنوعی')).toBeTruthy()
    expect(screen.getByText('دسترسی به سرور ابری قطع است.')).toBeTruthy()

    const dismissBtn = screen.getByRole('button', { name: 'offline.cloudRequired.dismiss' })
    fireEvent.click(dismissBtn)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders fullscreen variant with actions and headings', () => {
    const onRetry = vi.fn()
    const onHome = vi.fn()

    render(
      <CloudRequiredNotice
        variant="fullscreen"
        title="مارکت‌پلیس حسابچه"
        onRetry={onRetry}
        onHome={onHome}
      />,
    )

    const alert = screen.getByRole('alert')
    expect(alert.getAttribute('data-cloud-required')).toBe('fullscreen')
    expect(screen.getByRole('heading', { level: 1, name: 'مارکت‌پلیس حسابچه' })).toBeTruthy()

    const retryBtn = screen.getByRole('button', { name: /offline\.cloudRequired\.retry/ })
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledTimes(1)

    const homeBtn = screen.getByRole('button', { name: 'offline.cloudRequired.backToHome' })
    fireEvent.click(homeBtn)
    expect(onHome).toHaveBeenCalledTimes(1)
  })

  it('hides local data safe banner when showDataSafeNotice is false', () => {
    render(<CloudRequiredNotice showDataSafeNotice={false} />)
    expect(screen.queryByText('offline.cloudRequired.dataSafe')).toBeNull()
  })
})

describe('CloudRequiredNotice Design & Code Integrity', () => {
  const componentPath = join(__dirname, '../components/ui/cloud-required-notice.tsx')
  const src = readFileSync(componentPath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  it('uses design tokens only — zero hardcoded hex colors', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('uses RTL logical properties only — no physical left or right', () => {
    expect(src).not.toMatch(/\b(ml|mr|pl|pr|text-left|text-right)\b/)
    expect(src).not.toMatch(/\b(left|right):/)
  })

  it('declares accessible alert roles and live attributes', () => {
    expect(src).toContain('role="alert"')
    expect(src).toContain('aria-live="polite"')
  })

  it('is exported from packages/ui/src/index.ts barrel', () => {
    const barrel = readFileSync(join(__dirname, '../index.ts'), 'utf8')
    expect(barrel).toContain('CloudRequiredNotice')
  })
})

describe('offline.cloudRequired translation keys exist in fa, af, and en', () => {
  const locales = ['fa', 'af', 'en'] as const
  const requiredKeys = [
    'title',
    'badge',
    'description',
    'whyTitle',
    'whyDefault',
    'whatToDoTitle',
    'whatToDoDefault',
    'action',
    'dataSafe',
    'retry',
    'dismiss',
    'backToHome',
  ]

  it.each(locales)('every key exists and has non-empty text in %s', (locale) => {
    const jsonPath = join(__dirname, '../../../i18n/messages', locale, 'common.json')
    const catalog = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
      offline?: { cloudRequired?: Record<string, string> }
    }

    expect(catalog.offline?.cloudRequired).toBeDefined()
    const cr = catalog.offline!.cloudRequired!

    for (const key of requiredKeys) {
      expect(cr[key], `Missing key offline.cloudRequired.${key} in ${locale}`).toBeTruthy()
      expect(typeof cr[key]).toBe('string')
      expect(cr[key]!.length).toBeGreaterThan(0)
    }
  })
})
