// ============================================
// backend/src/pdf/PayslipPDFDocument.tsx
//
// V58 · P0-6b — the payslip document. Server-side @react-pdf/renderer, kept
// in structural parity with the invoice PDF's conventions: the same
// Vazirmatn fonts, the same reader's-language rule (Accept-Language →
// fa / fa-AF / en), the same workspace-scoped data contract.
//
// The document renders EXACTLY the payroll row the ledger holds: base,
// overtime, bonuses, deductions, tax, net. No figure is recomputed here —
// a payslip that recomputes is a second source of truth for pay.
// ============================================

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'

import { formatDate, formatNumber, resolveIntlLocale } from '@hisabche/formatting'

/** The three languages the documents render in. */
type PayslipLang = 'fa' | 'af' | 'en'

// ─── Font ──────────────────────────────────────────────────
const fontPath = path.resolve(__dirname, '../fonts')
Font.register({
  family: 'Vazirmatn',
  fonts: [
    { src: path.join(fontPath, 'Vazirmatn-Regular.ttf'), fontWeight: 400 },
    { src: path.join(fontPath, 'Vazirmatn-Bold.ttf'), fontWeight: 700 },
  ],
})

/** Persian (Iran), Dari (Afghanistan) and English are RTL-first or LTR. */
const isRTL = (lang: PayslipLang) => lang !== 'en'

interface PayslipLabels {
  title: string
  employee: string
  period: string
  baseSalary: string
  overtime: string
  bonuses: string
  deductions: string
  tax: string
  net: string
  paymentDate: string
  status: string
  notes: string
  unpaid: string
  paid: string
}

const LABELS: Record<PayslipLang, PayslipLabels> = {
  fa: {
    title: 'فیش حقوقی',
    employee: 'کارمند',
    period: 'دوره',
    baseSalary: 'حقوق پایه',
    overtime: 'اضافه‌کاری',
    bonuses: 'مزایا',
    deductions: 'کسورات',
    tax: 'مالیات',
    net: 'دریافتی خالص',
    paymentDate: 'تاریخ پرداخت',
    status: 'وضعیت',
    notes: 'یادداشت',
    unpaid: 'پرداخت نشده',
    paid: 'پرداخت شده',
  },
  af: {
    title: 'فیش حقوقی',
    employee: 'کارمند',
    period: 'دوره',
    baseSalary: 'حقوق اساسیه',
    overtime: 'کار فوق‌العاده',
    bonuses: 'مزایا',
    deductions: 'کسرات',
    tax: 'مالیه',
    net: 'دریافتی خالص',
    paymentDate: 'تاریخ پرداخت',
    status: 'وضعیت',
    notes: 'یادداشت',
    unpaid: 'پرداخت نشده',
    paid: 'پرداخت شده',
  },
  en: {
    title: 'Payslip',
    employee: 'Employee',
    period: 'Period',
    baseSalary: 'Base salary',
    overtime: 'Overtime',
    bonuses: 'Bonuses',
    deductions: 'Deductions',
    tax: 'Tax',
    net: 'Net pay',
    paymentDate: 'Payment date',
    status: 'Status',
    notes: 'Notes',
    unpaid: 'Unpaid',
    paid: 'Paid',
  },
}

export interface PayslipData {
  employeeName: string
  periodStart: string
  periodEnd: string
  baseSalary: number
  overtimeHours: number
  overtimeAmount: number
  bonuses: number
  deductions: number
  taxAmount: number
  netSalary: number
  currency: string
  status: string | null
  paymentDate: string | null
  notes: string | null
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Vazirmatn',
    fontSize: 10,
    padding: 36,
    color: '#111827',
  },
  title: { fontSize: 18, fontFamily: 'Vazirmatn', fontWeight: 700, marginBottom: 4 },
  period: { fontSize: 10, color: '#4b5563', marginBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 7,
  },
  label: { color: '#374151' },
  value: { fontWeight: 700 },
  net: { marginTop: 12, fontSize: 13, flexDirection: 'row', justifyContent: 'space-between' },
  netValue: { fontWeight: 700, fontSize: 13 },
  notes: { marginTop: 16, fontSize: 9, color: '#4b5563' },
  footer: { marginTop: 28, fontSize: 8, color: '#9ca3af' },
})

const fmt = (n: number, lang: PayslipLang) => formatNumber(n ?? 0, resolveIntlLocale(lang))

export function PayslipPDFDocument({
  payslip,
  lang,
  workspaceName,
}: {
  payslip: PayslipData
  lang: PayslipLang
  workspaceName: string
}) {
  const t = LABELS[lang]
  const rtl = isRTL(lang)
  const period = `${formatDate(payslip.periodStart, lang)} — ${formatDate(payslip.periodEnd, lang)}`
  const money = (n: number) => `${fmt(n, lang)} ${payslip.currency ?? ''}`.trim()

  const rows: Array<[string, string]> = [
    [t.baseSalary, money(payslip.baseSalary)],
    ...(payslip.overtimeAmount > 0
      ? ([
          [t.overtime, `${money(payslip.overtimeAmount)} (${fmt(payslip.overtimeHours, lang)})`],
        ] as Array<[string, string]>)
      : []),
    ...(payslip.bonuses > 0
      ? ([[t.bonuses, money(payslip.bonuses)]] as Array<[string, string]>)
      : []),
    ...(payslip.deductions > 0
      ? ([[t.deductions, money(payslip.deductions)]] as Array<[string, string]>)
      : []),
    ...(payslip.taxAmount > 0
      ? ([[t.tax, money(payslip.taxAmount)]] as Array<[string, string]>)
      : []),
  ]

  return (
    <Document title={`${t.title} — ${payslip.employeeName}`}>
      <Page size="A4" style={[s.page, { direction: rtl ? 'rtl' : 'ltr' }]}>
        <Text style={s.title}>{t.title}</Text>
        <Text style={s.period}>
          {workspaceName} · {period}
        </Text>

        <View style={s.row}>
          <Text style={s.label}>{t.employee}</Text>
          <Text style={s.value}>{payslip.employeeName}</Text>
        </View>
        {rows.map(([label, value]) => (
          <View style={s.row} key={label}>
            <Text style={s.label}>{label}</Text>
            <Text style={s.value}>{value}</Text>
          </View>
        ))}

        <View style={s.net}>
          <Text>{t.net}</Text>
          <Text style={s.netValue}>{money(payslip.netSalary)}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.label}>{t.status}</Text>
          <Text>
            {payslip.status === 'paid' ? t.paid : t.unpaid}
            {payslip.paymentDate ? ` · ${formatDate(payslip.paymentDate, lang)}` : ''}
          </Text>
        </View>

        {payslip.notes ? <Text style={s.notes}>{`${t.notes}: ${payslip.notes}`}</Text> : null}

        <Text style={s.footer}>Hisabche</Text>
      </Page>
    </Document>
  )
}
