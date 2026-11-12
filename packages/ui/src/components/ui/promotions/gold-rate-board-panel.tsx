'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber, toIsoDay } from '@hisabche/formatting'
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
  useFxSettings,
  useGoldOperations,
  useGoldReconciliations,
  useLatestMetalRate,
  useMetalRateHistory,
  useMyCapabilities,
  useReconcileGoldLocation,
  useRecordGoldMeltScrap,
  useRecordMetalRate,
  useRecordSecondHandGoldPurchase,
} from '@hisabche/api'

import { useBookCurrency } from '../../../hooks/use-book-currency'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'
import { DataTable, type TableColumn } from '../data-table'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { useToast } from '../toast-provider'
import { typedMinor, typedNumber } from '../business-packs/pack-shared'

const KARATS: readonly Karat[] = [24, 22, 21, 18, 14, 9]
const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4'

export function GoldRateBoardPanel() {
  const t = useTranslations('promotions')
  const tAll = useTranslations()
  const locale = useIntlLocale()
  const { date } = useDateFormat()
  const toast = useToast()
  const currency = useBookCurrency() ?? ''
  const fxSettings = useFxSettings()

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

  const tr = (key: string): string => tAll(key as Parameters<typeof tAll>[0])

  const [rateDate, setRateDate] = useState(() => toIsoDay(new Date()))
  const [rate24kInput, setRate24kInput] = useState('')

  const [shKarat, setShKarat] = useState<Karat>(18)
  const [shGrams, setShGrams] = useState('')
  const [shDeductionBp, setShDeductionBp] = useState('200')
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

  const storedKycThresholdMinor = fxSettings.data?.kycThresholdMinor ?? null
  const rate24kMinorInput = currency ? typedMinor(rate24kInput, currency) : null
  const shGramsNum = typedNumber(shGrams)
  const shDeductionNum = typedNumber(shDeductionBp) ?? 0
  const meltInNum = typedNumber(meltInputGrams)
  const meltRecNum = typedNumber(meltRecoveredGrams)
  const recSysNum = typedNumber(recSystemGrams)
  const recPhysNum = typedNumber(recPhysicalGrams)

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
      labelFallback: tr('gold.rateDate'),
      locked: true,
      render: (r) => date(r.rateDate),
    },
    {
      id: 'rate24k',
      labelKey: 'gold.rate24k',
      labelFallback: tr('gold.rate24k'),
      align: 'end',
      render: (r) => `${formatNumber(r.rate24kMinorPerGram, locale, 0)} ${currency}`,
    },
  ]

  const shPreview = useMemo(() => {
    if (shGramsNum === null || shGramsNum <= 0 || current24k <= 0) return null
    try {
      const mg = gramsToMilligrams(shGramsNum)
      return planSecondHandGoldPurchase({
        scrapWeightMg: mg,
        scrapKarat: shKarat,
        rateSnapshot: {
          rate24kMinorPerGram: current24k,
          capturedAt: latestRate.data?.createdAt ?? new Date().toISOString(),
          capturedBy: latestRate.data?.setBy ?? 'system',
        },
        deductionBp: shDeductionNum,
        kycThresholdMinor: storedKycThresholdMinor,
        hasIdentityCaptured: shFullName.trim().length >= 2 && shIdNumber.trim().length >= 3,
      })
    } catch (err) {
      return err instanceof Error ? err.message : null
    }
  }, [
    shGramsNum,
    shKarat,
    current24k,
    latestRate.data,
    shDeductionNum,
    storedKycThresholdMinor,
    shFullName,
    shIdNumber,
  ])

  const meltPreview = useMemo(() => {
    if (
      meltInNum === null ||
      meltInNum <= 0 ||
      meltRecNum === null ||
      meltRecNum < 0 ||
      current24k <= 0
    )
      return null
    try {
      return recordGoldMeltScrapMovement({
        inputWeightMg: gramsToMilligrams(meltInNum),
        recoveredPureMg: gramsToMilligrams(meltRecNum),
        rate24kMinorPerGram: current24k,
      })
    } catch (err) {
      return err instanceof Error ? err.message : null
    }
  }, [meltInNum, meltRecNum, current24k])

  const recPreview = useMemo(() => {
    if (recSysNum === null || recSysNum < 0 || recPhysNum === null || recPhysNum < 0) return null
    return reconcileGoldLocationWeights({
      location: recLocation,
      systemWeightMg: gramsToMilligrams(recSysNum),
      physicalCountedMg: gramsToMilligrams(recPhysNum),
    })
  }, [recLocation, recSysNum, recPhysNum])

  return (
    <div className="space-y-4">
      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
              {tr('gold.rateBoardTitle')}
            </h2>
            <p className="text-xs text-[hsl(var(--fg-secondary))]">
              {current24k > 0
                ? `${tr('gold.latest24k')}: ${formatNumber(current24k, locale, 0)} ${currency}`
                : tr('gold.noRateYet')}
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
                inputMode="decimal"
                className="w-44"
                value={rate24kInput}
                placeholder={tr('gold.enterRate24k')}
                onChange={(e) => setRate24kInput(e.target.value)}
              />
              <Button
                size="sm"
                disabled={
                  !rateDate || !rate24kMinorInput || rate24kMinorInput <= 0 || recordRate.isPending
                }
                onClick={() => {
                  if (!rate24kMinorInput) return
                  recordRate.mutate(
                    { rateDate, rate24kMinorPerGram: rate24kMinorInput },
                    {
                      onSuccess: () => {
                        toast.success(tr('gold.rateSaved'))
                        setRate24kInput('')
                      },
                      onError: (e) => toast.error(apiErrorMessage(e, t('errors.general'))),
                    },
                  )
                }}
              >
                {tr('gold.saveRate')}
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
            t={tr}
            rows={rateHistory.data ?? []}
            columns={rateColumns}
            rowKey={(r) => r.id}
            paginate={false}
          />
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${card} space-y-2`}>
          <h3 className="text-sm font-semibold">{tr('gold.secondHandTitle')}</h3>
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
            placeholder={tr('gold.weightGrams')}
            onChange={(e) => setShGrams(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              name="shDeductionBp"
              inputMode="numeric"
              value={shDeductionBp}
              placeholder={tr('gold.deductionBp')}
              onChange={(e) => setShDeductionBp(e.target.value)}
            />
            <div
              data-kyc-threshold-readonly=""
              className="flex items-center rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] px-2 text-xs text-[hsl(var(--fg-secondary))]"
            >
              {tr('gold.kycThreshold')}:{' '}
              {storedKycThresholdMinor !== null
                ? `${formatNumber(storedKycThresholdMinor, locale, 0)} ${currency}`
                : '—'}
            </div>
          </div>
          <Input
            name="shFullName"
            value={shFullName}
            placeholder={tr('exchange.fullName')}
            onChange={(e) => setShFullName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              name="shIdType"
              value={shIdType}
              onChange={(v) => setShIdType(v as typeof shIdType)}
              options={[
                { value: 'national_id', label: tr('exchange.idTypes.national_id') },
                { value: 'passport', label: tr('exchange.idTypes.passport') },
                { value: 'driving_licence', label: tr('exchange.idTypes.driving_licence') },
                { value: 'other', label: tr('exchange.idTypes.other') },
              ]}
            />
            <Input
              name="shIdNumber"
              value={shIdNumber}
              placeholder={tr('exchange.idNumber')}
              onChange={(e) => setShIdNumber(e.target.value)}
            />
          </div>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {typeof shPreview === 'string'
              ? tr(`gold.errors.${shPreview}`)
              : shPreview
                ? `${tr('gold.netCredit')}: ${formatNumber(shPreview.netCreditMinor, locale, 0)} ${currency}`
                : '—'}
          </p>
          <Button
            size="sm"
            disabled={
              !shPreview ||
              typeof shPreview === 'string' ||
              shGramsNum === null ||
              recordSecondHand.isPending
            }
            onClick={() => {
              if (shGramsNum === null) return
              recordSecondHand.mutate(
                {
                  karat: shKarat,
                  scrapWeightMg: gramsToMilligrams(shGramsNum),
                  deductionBp: shDeductionNum,
                  kycThresholdMinor: storedKycThresholdMinor,
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
                    toast.success(tr('gold.secondHandSaved'))
                    setShGrams('')
                  },
                  onError: (e) => toast.error(apiErrorMessage(e, t('errors.general'))),
                },
              )
            }}
          >
            {tr('gold.recordSecondHand')}
          </Button>
        </div>

        <div className={`${card} space-y-2`}>
          <h3 className="text-sm font-semibold">{tr('gold.meltTitle')}</h3>
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
            placeholder={tr('gold.inputWeightGrams')}
            onChange={(e) => setMeltInputGrams(e.target.value)}
          />
          <Input
            name="meltRecoveredGrams"
            inputMode="decimal"
            value={meltRecoveredGrams}
            placeholder={tr('gold.recoveredGrams')}
            onChange={(e) => setMeltRecoveredGrams(e.target.value)}
          />
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {typeof meltPreview === 'string'
              ? tr(`gold.errors.${meltPreview}`)
              : meltPreview
                ? `${tr('gold.lossGrams')}: ${milligramsToGrams(meltPreview.weightLossMg)} g`
                : '—'}
          </p>
          <Button
            size="sm"
            disabled={
              !mayAdjustStock ||
              !meltPreview ||
              typeof meltPreview === 'string' ||
              meltInNum === null ||
              meltRecNum === null ||
              recordMelt.isPending
            }
            onClick={() => {
              if (meltInNum === null || meltRecNum === null) return
              recordMelt.mutate(
                {
                  karat: meltKarat,
                  inputWeightMg: gramsToMilligrams(meltInNum),
                  recoveredPureMg: gramsToMilligrams(meltRecNum),
                },
                {
                  onSuccess: () => {
                    toast.success(tr('gold.meltSaved'))
                    setMeltInputGrams('')
                    setMeltRecoveredGrams('')
                  },
                  onError: (e) => toast.error(apiErrorMessage(e, t('errors.general'))),
                },
              )
            }}
          >
            {tr('gold.recordMelt')}
          </Button>
        </div>

        <div className={`${card} space-y-2`}>
          <h3 className="text-sm font-semibold">{tr('gold.reconcileTitle')}</h3>
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              name="recLocation"
              value={recLocation}
              onChange={(v) => setRecLocation(v as 'showcase' | 'safe')}
              options={[
                { value: 'showcase', label: tr('gold.locations.showcase') },
                { value: 'safe', label: tr('gold.locations.safe') },
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
            placeholder={tr('gold.systemGrams')}
            onChange={(e) => setRecSystemGrams(e.target.value)}
          />
          <Input
            name="recPhysicalGrams"
            inputMode="decimal"
            value={recPhysicalGrams}
            placeholder={tr('gold.physicalGrams')}
            onChange={(e) => setRecPhysicalGrams(e.target.value)}
          />
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {recPreview
              ? `${tr('exchange.variance')}: ${milligramsToGrams(recPreview.varianceMg)} g`
              : '—'}
          </p>
          <Button
            size="sm"
            disabled={
              !mayAdjustStock ||
              !recPreview ||
              recSysNum === null ||
              recPhysNum === null ||
              reconcileLocation.isPending
            }
            onClick={() => {
              if (recSysNum === null || recPhysNum === null) return
              reconcileLocation.mutate(
                {
                  location: recLocation,
                  karat: recKarat,
                  systemWeightMg: gramsToMilligrams(recSysNum),
                  physicalCountedMg: gramsToMilligrams(recPhysNum),
                },
                {
                  onSuccess: () => {
                    toast.success(tr('gold.reconcileSaved'))
                    setRecSystemGrams('')
                    setRecPhysicalGrams('')
                  },
                  onError: (e) => toast.error(apiErrorMessage(e, t('errors.general'))),
                },
              )
            }}
          >
            {tr('gold.recordReconcile')}
          </Button>
          {(operations.data?.operations.length ?? 0) +
            (reconciliations.data?.reconciliations.length ?? 0) >
          0 ? (
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {tr('gold.recordedCount')}:{' '}
              {(operations.data?.operations.length ?? 0) +
                (reconciliations.data?.reconciliations.length ?? 0)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
