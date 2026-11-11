'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber, toIsoDay } from '@hisabche/formatting'
import { useCurrencyStore } from '@hisabche/store'
import {
  deriveKaratGramRate,
  gramsToMilligrams,
  milligramsToGrams,
  planSecondHandGoldPurchase,
  reconcileGoldLocationWeights,
  recordGoldMeltScrapMovement,
  type Karat,
} from '@hisabche/validation'
import {
  apiErrorMessage,
  useGoldOperations,
  useGoldReconciliations,
  useLatestMetalRate,
  useMyCapabilities,
  useMetalRateHistory,
  useReconcileGoldLocation,
  useRecordGoldMeltScrap,
  useRecordMetalRate,
  useRecordSecondHandGoldPurchase,
} from '@hisabche/api'

import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'
import { DataTable, type TableColumn } from '../data-table'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'

const KARATS: readonly Karat[] = [24, 22, 21, 18, 14, 9]
const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4'

export function GoldRateBoardPanel() {
  const t = useTranslations('promotions')
  const tAll = useTranslations()
  const locale = useIntlLocale()
  const { date } = useDateFormat()
  const toast = useToast()
  const currency = useCurrencyStore((s) => s.primaryCurrency)

  const latestRate = useLatestMetalRate()
  const rateHistory = useMetalRateHistory()
  const recordRate = useRecordMetalRate()
  const operations = useGoldOperations()
  const recordSecondHand = useRecordSecondHandGoldPurchase()
  const recordMelt = useRecordGoldMeltScrap()
  const reconciliations = useGoldReconciliations()
  const reconcileLocation = useReconcileGoldLocation()
  // The server refuses these without the capability; do not offer a button that
  // can only fail. `false` = known not held; `undefined` (still loading) stays hidden too.
  const capabilities = useMyCapabilities()
  const maySetRate = capabilities.can('product.write') === true
  const mayAdjustStock = capabilities.can('stock.adjust') === true

  const safeT = (key: string, fallback?: string) => {
    try {
      const v = tAll(key as Parameters<typeof tAll>[0])
      return v && v !== key ? v : (fallback ?? key)
    } catch {
      return fallback ?? key
    }
  }

  const [rateDate, setRateDate] = useState(() => toIsoDay(new Date()))
  const [rate24kInput, setRate24kInput] = useState('')

  const [shKarat, setShKarat] = useState<Karat>(18)
  const [shGrams, setShGrams] = useState('')
  const [shDeductionBp, setShDeductionBp] = useState('200')
  const [shKycLimit, setShKycLimit] = useState('50000')
  const [shFullName, setShFullName] = useState('')
  const [shIdType, setShIdType] = useState<
    'national_id' | 'passport' | 'driving_licence' | 'other'
  >('national_id')
  const [shIdNumber, setShIdNumber] = useState('')

  const [meltKarat, setMeltKarat] = useState<Karat>(21)
  const [meltInputGrams, setMeltInputGrams] = useState('')
  const [meltRecoveredGrams, setMeltRecoveredGrams] = useState('')

  const [recLocation, setRecLocation] = useState<'showcase' | 'safe'>('showcase')
  const [recKarat, setRecKarat] = useState<Karat>(21)
  const [recSystemGrams, setRecSystemGrams] = useState('')
  const [recPhysicalGrams, setRecPhysicalGrams] = useState('')

  const current24k = latestRate.data?.rate24kMinorPerGram ?? 0
  const karatRows = useMemo(
    () =>
      KARATS.map((karat) => ({
        karat,
        gramRate: current24k > 0 ? deriveKaratGramRate(current24k, karat) : null,
      })),
    [current24k],
  )

  const rateColumns: TableColumn<{
    id: string
    rateDate: string
    rate24kMinorPerGram: number
  }>[] = [
    {
      id: 'date',
      labelKey: 'gold.rateDate',
      labelFallback: 'تاریخ',
      locked: true,
      render: (r) => date(r.rateDate),
    },
    {
      id: 'rate24k',
      labelKey: 'gold.rate24k',
      labelFallback: 'نرخ طلای ۲۴ عیار (فی گرام)',
      align: 'end',
      render: (r) => `${formatNumber(r.rate24kMinorPerGram, locale, 0)} ${currency}`,
    },
  ]

  const shPreview = useMemo(() => {
    const g = Number(shGrams)
    if (!Number.isFinite(g) || g <= 0 || current24k <= 0) return null
    try {
      const mg = gramsToMilligrams(g)
      return planSecondHandGoldPurchase({
        scrapWeightMg: mg,
        scrapKarat: shKarat,
        rateSnapshot: {
          rate24kMinorPerGram: current24k,
          capturedAt: latestRate.data?.createdAt ?? new Date().toISOString(),
          capturedBy: latestRate.data?.setBy ?? 'system',
        },
        deductionBp: Number(shDeductionBp) || 0,
        kycThresholdMinor: Number(shKycLimit) > 0 ? Number(shKycLimit) : null,
        hasIdentityCaptured: shFullName.trim().length >= 2 && shIdNumber.trim().length >= 3,
      })
    } catch (err) {
      return err instanceof Error ? err.message : null
    }
  }, [
    shGrams,
    shKarat,
    current24k,
    latestRate.data,
    shDeductionBp,
    shKycLimit,
    shFullName,
    shIdNumber,
  ])

  const meltPreview = useMemo(() => {
    const inG = Number(meltInputGrams)
    const recG = Number(meltRecoveredGrams)
    if (!Number.isFinite(inG) || inG <= 0 || !Number.isFinite(recG) || recG < 0 || current24k <= 0)
      return null
    try {
      return recordGoldMeltScrapMovement({
        inputWeightMg: gramsToMilligrams(inG),
        recoveredPureMg: gramsToMilligrams(recG),
        rate24kMinorPerGram: current24k,
      })
    } catch (err) {
      return err instanceof Error ? err.message : null
    }
  }, [meltInputGrams, meltRecoveredGrams, current24k])

  const recPreview = useMemo(() => {
    const sys = Number(recSystemGrams)
    const phys = Number(recPhysicalGrams)
    if (!Number.isFinite(sys) || sys < 0 || !Number.isFinite(phys) || phys < 0) return null
    return reconcileGoldLocationWeights({
      location: recLocation,
      systemWeightMg: gramsToMilligrams(sys),
      physicalCountedMg: gramsToMilligrams(phys),
    })
  }, [recLocation, recSystemGrams, recPhysicalGrams])

  return (
    <div className="space-y-4">
      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
              {safeT('gold.rateBoardTitle', 'تابلوی نرخ طلا')}
            </h2>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">
              {current24k > 0
                ? `${safeT('gold.latest24k', 'آخرین نرخ ۲۴ عیار')}: ${formatNumber(current24k, locale, 0)} ${currency}`
                : safeT('gold.noRateYet', 'هنوز نرخی ثبت نشده است')}
            </p>
          </div>
          {maySetRate ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                name="rateDate"
                className="w-40"
                value={rateDate}
                onChange={(e) => setRateDate(e.target.value)}
              />
              <Input
                name="rate24kMinorPerGram"
                inputMode="numeric"
                className="w-44"
                value={rate24kInput}
                placeholder={safeT('gold.enterRate24k', 'نرخ ۱ گرام ۲۴ عیار')}
                onChange={(e) => setRate24kInput(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!rateDate || !(Number(rate24kInput) > 0) || recordRate.isPending}
                onClick={() =>
                  recordRate.mutate(
                    { rateDate, rate24kMinorPerGram: Math.round(Number(rate24kInput)) },
                    {
                      onSuccess: () => {
                        toast.success(safeT('gold.rateSaved', 'نرخ طلا ثبت شد'))
                        setRate24kInput('')
                      },
                      onError: (e) => toast.error(apiErrorMessage(e, t('errors.general'))),
                    },
                  )
                }
              >
                {safeT('gold.saveRate', 'ثبت نرخ')}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-6">
          {karatRows.map((row) => (
            <div
              key={row.karat}
              className="rounded-xl border border-[hsl(var(--border-default))] p-2 text-center"
            >
              <div className="text-xs text-[hsl(var(--fg-secondary))]">{row.karat}K</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {row.gramRate === null ? '—' : formatNumber(row.gramRate, locale, 0)}
              </div>
            </div>
          ))}
        </div>

        {(rateHistory.data?.length ?? 0) > 0 ? (
          <DataTable
            tableId="gold-rate-history"
            t={safeT}
            rows={rateHistory.data ?? []}
            columns={rateColumns}
            rowKey={(r) => r.id}
            paginate={false}
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${card} space-y-2`}>
          <h3 className="text-sm font-semibold">
            {safeT('gold.secondHandTitle', 'خرید طلای دست‌دوم (KYC)')}
          </h3>
          <SelectField
            name="shKarat"
            value={String(shKarat)}
            onChange={(v) => setShKarat(Number(v) as Karat)}
            options={KARATS.map((k) => ({ value: String(k), label: `${k}K` }))}
          />
          <Input
            name="shGrams"
            inputMode="decimal"
            value={shGrams}
            placeholder={safeT('gold.weightGrams', 'وزن (گرام)')}
            onChange={(e) => setShGrams(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              name="shDeductionBp"
              inputMode="numeric"
              value={shDeductionBp}
              placeholder={safeT('gold.deductionBp', 'کسر (bp)')}
              onChange={(e) => setShDeductionBp(e.target.value)}
            />
            <Input
              name="shKycLimit"
              inputMode="numeric"
              value={shKycLimit}
              placeholder={safeT('gold.kycThreshold', 'حد احراز هویت')}
              onChange={(e) => setShKycLimit(e.target.value)}
            />
          </div>
          <Input
            name="shFullName"
            value={shFullName}
            placeholder={safeT('exchange.fullName', 'نام کامل')}
            onChange={(e) => setShFullName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              name="shIdType"
              value={shIdType}
              onChange={(v) => setShIdType(v as typeof shIdType)}
              options={[
                {
                  value: 'national_id',
                  label: safeT('exchange.idTypes.national_id', 'تذکره / ملی'),
                },
                { value: 'passport', label: safeT('exchange.idTypes.passport', 'گذرنامه') },
                {
                  value: 'driving_licence',
                  label: safeT('exchange.idTypes.driving_licence', 'گواهینامه'),
                },
                { value: 'other', label: safeT('exchange.idTypes.other', 'سایر') },
              ]}
            />
            <Input
              name="shIdNumber"
              value={shIdNumber}
              placeholder={safeT('exchange.idNumber', 'شماره سند')}
              onChange={(e) => setShIdNumber(e.target.value)}
            />
          </div>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {typeof shPreview === 'string'
              ? safeT(`gold.errors.${shPreview}`, shPreview)
              : shPreview
                ? `${safeT('gold.netCredit', 'اعتبار خالص')}: ${formatNumber(shPreview.netCreditMinor, locale, 0)} ${currency}`
                : '—'}
          </p>
          <Button
            size="sm"
            disabled={!shPreview || typeof shPreview === 'string' || recordSecondHand.isPending}
            onClick={() =>
              recordSecondHand.mutate(
                {
                  karat: shKarat,
                  scrapWeightMg: gramsToMilligrams(Number(shGrams)),
                  deductionBp: Number(shDeductionBp) || 0,
                  kycThresholdMinor: Number(shKycLimit) > 0 ? Number(shKycLimit) : null,
                  ...(shFullName.trim().length >= 2 && shIdNumber.trim().length >= 3
                    ? {
                        identity: {
                          fullName: shFullName.trim(),
                          idType: shIdType,
                          idNumber: shIdNumber.trim(),
                        },
                      }
                    : {}),
                },
                {
                  onSuccess: () => {
                    toast.success(safeT('gold.secondHandSaved', 'خرید دست‌دوم ثبت شد'))
                    setShGrams('')
                  },
                  onError: (e) => toast.error(apiErrorMessage(e, t('errors.general'))),
                },
              )
            }
          >
            {safeT('gold.recordSecondHand', 'ثبت خرید دست‌دوم')}
          </Button>
        </div>

        <div className={`${card} space-y-2`}>
          <h3 className="text-sm font-semibold">{safeT('gold.meltTitle', 'ذوب و کسری ذوب')}</h3>
          <SelectField
            name="meltKarat"
            value={String(meltKarat)}
            onChange={(v) => setMeltKarat(Number(v) as Karat)}
            options={KARATS.map((k) => ({ value: String(k), label: `${k}K` }))}
          />
          <Input
            name="meltInputGrams"
            inputMode="decimal"
            value={meltInputGrams}
            placeholder={safeT('gold.inputWeightGrams', 'وزن ورودی (گرام)')}
            onChange={(e) => setMeltInputGrams(e.target.value)}
          />
          <Input
            name="meltRecoveredGrams"
            inputMode="decimal"
            value={meltRecoveredGrams}
            placeholder={safeT('gold.recoveredGrams', 'خالص بازیافتی (گرام)')}
            onChange={(e) => setMeltRecoveredGrams(e.target.value)}
          />
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {typeof meltPreview === 'string'
              ? safeT(`gold.errors.${meltPreview}`, meltPreview)
              : meltPreview
                ? `${safeT('gold.lossGrams', 'کسری ذوب')}: ${milligramsToGrams(meltPreview.weightLossMg)} g`
                : '—'}
          </p>
          <Button
            size="sm"
            disabled={
              !mayAdjustStock ||
              !meltPreview ||
              typeof meltPreview === 'string' ||
              recordMelt.isPending
            }
            onClick={() =>
              recordMelt.mutate(
                {
                  karat: meltKarat,
                  inputWeightMg: gramsToMilligrams(Number(meltInputGrams)),
                  recoveredPureMg: gramsToMilligrams(Number(meltRecoveredGrams)),
                },
                {
                  onSuccess: () => {
                    toast.success(safeT('gold.meltSaved', 'عملیات ذوب ثبت شد'))
                    setMeltInputGrams('')
                    setMeltRecoveredGrams('')
                  },
                  onError: (e) => toast.error(apiErrorMessage(e, t('errors.general'))),
                },
              )
            }
          >
            {safeT('gold.recordMelt', 'ثبت ذوب')}
          </Button>
        </div>

        <div className={`${card} space-y-2`}>
          <h3 className="text-sm font-semibold">
            {safeT('gold.reconcileTitle', 'شمارش ویترین و گاوصندوق')}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              name="recLocation"
              value={recLocation}
              onChange={(v) => setRecLocation(v as 'showcase' | 'safe')}
              options={[
                { value: 'showcase', label: safeT('gold.locations.showcase', 'ویترین') },
                { value: 'safe', label: safeT('gold.locations.safe', 'گاوصندوق') },
              ]}
            />
            <SelectField
              name="recKarat"
              value={String(recKarat)}
              onChange={(v) => setRecKarat(Number(v) as Karat)}
              options={KARATS.map((k) => ({ value: String(k), label: `${k}K` }))}
            />
          </div>
          <Input
            name="recSystemGrams"
            inputMode="decimal"
            value={recSystemGrams}
            placeholder={safeT('gold.systemGrams', 'وزن سیستم (گرام)')}
            onChange={(e) => setRecSystemGrams(e.target.value)}
          />
          <Input
            name="recPhysicalGrams"
            inputMode="decimal"
            value={recPhysicalGrams}
            placeholder={safeT('gold.physicalGrams', 'وزن شمارش‌شده (گرام)')}
            onChange={(e) => setRecPhysicalGrams(e.target.value)}
          />
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {recPreview
              ? `${safeT('exchange.variance', 'اختلاف')}: ${milligramsToGrams(recPreview.varianceMg)} g`
              : '—'}
          </p>
          <Button
            size="sm"
            disabled={!mayAdjustStock || !recPreview || reconcileLocation.isPending}
            onClick={() =>
              reconcileLocation.mutate(
                {
                  location: recLocation,
                  karat: recKarat,
                  systemWeightMg: gramsToMilligrams(Number(recSystemGrams)),
                  physicalCountedMg: gramsToMilligrams(Number(recPhysicalGrams)),
                },
                {
                  onSuccess: () => {
                    toast.success(safeT('gold.reconcileSaved', 'شمارش وزن ثبت شد'))
                    setRecSystemGrams('')
                    setRecPhysicalGrams('')
                  },
                  onError: (e) => toast.error(apiErrorMessage(e, t('errors.general'))),
                },
              )
            }
          >
            {safeT('gold.recordReconcile', 'ثبت مغایرت‌گیری')}
          </Button>
          {(operations.data?.operations.length ?? 0) +
            (reconciliations.data?.reconciliations.length ?? 0) >
          0 ? (
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {safeT('gold.recordedCount', 'ثبت‌های انجام‌شده')}:{' '}
              {(operations.data?.operations.length ?? 0) +
                (reconciliations.data?.reconciliations.length ?? 0)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
