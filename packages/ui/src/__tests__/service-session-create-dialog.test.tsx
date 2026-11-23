// ============================================
// packages/ui/src/__tests__/service-session-create-dialog.test.tsx
//
// Tests for the simplified ServiceSessionCreateDialog:
// - Service field is a normal free-text input (sessionType).
// - No service catalog selector, dropdown, or autocomplete.
// - No offline service warning.
// - Direct typing of Persian and English titles.
// - Validation: title required, max 120 chars.
// - Submits sessionType with serviceOfferingId: null.
// ============================================

import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mutateMock = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign((key: string, values?: Record<string, unknown>) => key, {
      raw: () => undefined,
      has: () => false,
    }),
  useLocale: () => 'fa',
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/fa/customers',
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ lang: 'fa' }),
}))

vi.mock('@hisabche/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hisabche/api')>()
  return {
    ...actual,
    useCreateServiceDeliverySession: () => ({
      mutate: mutateMock,
      isPending: false,
    }),
    useCustomers: () => ({
      data: {
        data: [
          { id: 'cust-1', name: 'احمد رضایی', phone: '0799123456' },
          { id: 'cust-2', name: 'زهرا کاظمی', phone: '0788123456' },
        ],
      },
      isLoading: false,
      isError: false,
    }),
    useCreateCustomer: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
  }
})

import { ServiceSessionCreateDialog } from '../components/ui/service-delivery/service-session-create-dialog'

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  customerOptions: [
    { value: 'cust-1', label: 'احمد رضایی' },
    { value: 'cust-2', label: 'زهرا کاظمی' },
  ],
  serviceOptions: [],
  practitionerOptions: [{ value: 'doc-1', label: 'دکتر کریمی' }],
  branchOptions: [],
  hasBranches: false,
}

describe('ServiceSessionCreateDialog - Free-text Service Field Simplification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('renders a normal free-text input for service / session title', async () => {
    await act(async () => {
      render(<ServiceSessionCreateDialog {...defaultProps} />)
    })

    const input = document.querySelector('input[name="sessionType"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.tagName.toLowerCase()).toBe('input')
    expect(input.type).toBe('text')
    expect(input.maxLength).toBe(120)

    // Check placeholder
    expect(input.placeholder).toContain('مشاوره')

    // Check helper text
    expect(screen.getByText('نام خدمت یا موضوع جلسه را وارد کنید.')).toBeTruthy()
  })

  it('does NOT render a SelectInput, dropdown, or catalog selector for the service', async () => {
    await act(async () => {
      render(<ServiceSessionCreateDialog {...defaultProps} />)
    })

    // Must not have a select input or combobox for serviceOfferingId
    expect(document.querySelector('select[name="serviceOfferingId"]')).toBeNull()
    expect(document.querySelector('input[name="serviceOfferingId"]')).toBeNull()
    expect(document.querySelector('[data-field="serviceOfferingId"]')).toBeNull()
  })

  it('never renders the confusing offline service catalog warning', async () => {
    await act(async () => {
      render(
        <ServiceSessionCreateDialog
          {...defaultProps}
          serviceHint="نوع خدمت/کالا روی این دستگاه ذخیره نشده است؛ برای آنلاین شدن خدمت ..."
        />,
      )
    })

    // The component ignores serviceHint and does not render it
    expect(screen.queryByText(/نوع خدمت\/کالا روی این دستگاه ذخیره نشده است/)).toBeNull()
  })

  it('allows direct typing of arbitrary Persian service titles', async () => {
    await act(async () => {
      render(<ServiceSessionCreateDialog {...defaultProps} />)
    })

    const input = document.querySelector('input[name="sessionType"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'مشاوره تغذیه و سلامت' } })
    expect(input.value).toBe('مشاوره تغذیه و سلامت')
  })

  it('allows direct typing of arbitrary English service titles', async () => {
    await act(async () => {
      render(<ServiceSessionCreateDialog {...defaultProps} />)
    })

    const input = document.querySelector('input[name="sessionType"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Haircut & Styling' } })
    expect(input.value).toBe('Haircut & Styling')
  })

  it('validates that session title is required when submitted empty', async () => {
    await act(async () => {
      render(<ServiceSessionCreateDialog {...defaultProps} />)
    })

    // Submit button
    const submitBtn = screen.getByRole('button', { name: 'ساختن جلسه' })
    await act(async () => {
      fireEvent.click(submitBtn)
    })

    // Error message displayed
    expect(screen.getByText('نام خدمت یا موضوع جلسه را بنویسید')).toBeTruthy()
    expect(mutateMock).not.toHaveBeenCalled()
  })

  it('validates that session title cannot exceed 120 characters', async () => {
    await act(async () => {
      render(<ServiceSessionCreateDialog {...defaultProps} presetCustomerId="cust-1" />)
    })

    const input = document.querySelector('input[name="sessionType"]') as HTMLInputElement
    const longTitle = 'الف'.repeat(125)
    fireEvent.change(input, { target: { value: longTitle } })

    const submitBtn = screen.getByRole('button', { name: 'ساختن جلسه' })
    await act(async () => {
      fireEvent.click(submitBtn)
    })

    expect(screen.getByText('عنوان جلسه نمی‌تواند بیش از ۱۲۰ نویسه باشد')).toBeTruthy()
    expect(mutateMock).not.toHaveBeenCalled()
  })

  it('submits sessionType with serviceOfferingId: null when valid', async () => {
    await act(async () => {
      render(<ServiceSessionCreateDialog {...defaultProps} presetCustomerId="cust-1" />)
    })

    const input = document.querySelector('input[name="sessionType"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'معاینه دوره‌ای' } })

    const submitBtn = screen.getByRole('button', { name: 'ساختن جلسه' })
    await act(async () => {
      fireEvent.click(submitBtn)
    })

    expect(mutateMock).toHaveBeenCalledTimes(1)
    const callArgs = mutateMock.mock.calls[0]![0]
    expect(callArgs).toMatchObject({
      subjectType: 'customer',
      customerId: 'cust-1',
      sessionType: 'معاینه دوره‌ای',
      serviceOfferingId: null,
    })
  })
})
