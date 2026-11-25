// ============================================
// Regression & Guard Tests for Browser Console Errors & Party Picker:
//   1. NumberStepper never wraps focusable stepper buttons in aria-hidden="true"
//      and prevents mousedown focus-stealing.
//   2. CustomerPicker renders customers on sale/pre_sale and suppliers on
//      purchase/pre_purchase, skips empty IDs, and resets search on partyType switch.
//   3. Switching trading side (purchase <-> sale) drops incompatible parties from
//      draft.customers so customer-only profile / price-list endpoints never 404.
//   4. provider-commissions callers require explicit capabilities.can('payroll.read')
//      === true (not !== false) and resource_capacity profile gating.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')

const pickerFixtures = vi.hoisted(() => ({
  customers: [
    { id: 'cust-1', fullName: 'حامد محمدی', phone: '09120000001' },
    { id: 'cust-2', fullName: 'سارا رضایی', phone: '09120000002' },
    { id: '', fullName: 'رکورد بدون شناسه', phone: '' },
  ],
  suppliers: [
    { id: 'supp-1', name: 'تأمین‌کننده پارس', phone: '02100000001' },
    { id: 'supp-2', name: 'بازرگانی سپهر', phone: '02100000002' },
  ],
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'fa',
}))

vi.mock('@hisabche/api', () => ({
  useCustomers: (filters: { search?: string }) => ({
    data: {
      customers: filters.search
        ? pickerFixtures.customers.filter((c) => c.fullName.includes(filters.search!))
        : pickerFixtures.customers,
      total: pickerFixtures.customers.length,
    },
    isLoading: false,
  }),
  useSuppliers: (filters: { search?: string }) => ({
    data: filters.search
      ? pickerFixtures.suppliers.filter((s) => s.name.includes(filters.search!))
      : pickerFixtures.suppliers,
    isLoading: false,
  }),
  useCreateCustomer: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateSupplier: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

import { NumberStepper } from '../components/ui/number-stepper'
import { CustomerPicker } from '../components/ui/customer-picker'

afterEach(() => {
  cleanup()
})

describe('NumberStepper accessibility and focus handling', () => {
  it('never places focusable stepper buttons inside an aria-hidden ancestor', () => {
    const onValueChange = vi.fn()
    render(<NumberStepper value="10" onValueChange={onValueChange} step={1} aria-label="تعداد" />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)

    for (const button of buttons) {
      expect(button.getAttribute('aria-hidden')).not.toBe('true')
      expect(button.closest('[aria-hidden="true"]')).toBeNull()

      const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
      const notCancelled = button.dispatchEvent(mouseDown)
      expect(notCancelled).toBe(false)
    }

    fireEvent.click(buttons[0]!)
    expect(onValueChange).toHaveBeenCalledWith('11')
    fireEvent.click(buttons[1]!)
    expect(onValueChange).toHaveBeenCalledWith('9')
  })
})

describe('CustomerPicker partyType switching', () => {
  it('renders customers for sale/pre_sale, filters empty IDs, and switches cleanly to suppliers', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <CustomerPicker value={null} partyType="customer" onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByText('حامد محمدی')).toBeTruthy()
    expect(screen.getByText('سارا رضایی')).toBeTruthy()
    expect(screen.queryByText('رکورد بدون شناسه')).toBeNull()

    const searchInput = screen.getByPlaceholderText('جستجو...') as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'حامد' } })
    expect(searchInput.value).toBe('حامد')

    rerender(<CustomerPicker value={null} partyType="supplier" onChange={onChange} />)
    expect((screen.getByPlaceholderText('جستجو...') as HTMLInputElement).value).toBe('')
    expect(screen.getByText('تأمین‌کننده پارس')).toBeTruthy()
    expect(screen.getByText('بازرگانی سپهر')).toBeTruthy()
  })
})

describe('Source guards for 403 provider-commissions and 404 party switch', () => {
  it('requires explicit payroll.read capability before enabling provider-commissions queries', () => {
    const dashboard = readFileSync(
      join(
        ROOT,
        'packages',
        'ui',
        'src',
        'components',
        'ui',
        'dashboard',
        'containers',
        'dashboard-container.tsx',
      ),
      'utf8',
    )
    const salon = readFileSync(
      join(
        ROOT,
        'packages',
        'ui',
        'src',
        'components',
        'ui',
        'business-packs',
        'salon-sections.tsx',
      ),
      'utf8',
    )

    expect(dashboard).toContain('access !== undefined &&')
    expect(dashboard).toContain("access.capabilities.includes('payroll.read')")
    expect(dashboard).toContain("requestedCapabilities.includes('resource_capacity')")
    expect(salon).toContain("capabilities.can('payroll.read') === true")
    expect(salon).not.toContain("capabilities.can('payroll.read') !== false")
  })

  it('drops incompatible partyType entries from draft.customers when switching trading sides', () => {
    const builder = readFileSync(
      join(
        ROOT,
        'packages',
        'ui',
        'src',
        'components',
        'ui',
        'invoice-builder',
        'containers',
        'invoice-builder-container.tsx',
      ),
      'utf8',
    )
    expect(builder).toContain("const targetParty = side === 'purchase' ? 'supplier' : 'customer'")
    expect(builder).toContain('c.partyType === targetParty')
    expect(builder).toContain("setDraftField('customers', compatible)")
  })
})
