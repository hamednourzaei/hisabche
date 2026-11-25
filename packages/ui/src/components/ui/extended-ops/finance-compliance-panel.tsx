'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useAllocateWaitlist,
  useConsolidatedSummary,
  useCreateChangeOrder,
  useESignContract,
  useEvaluateContractGuarantee,
  useEvaluateFxKyc,
  useEvaluateNoShowFee,
  useMatchBankTransactions,
  useScheduleSubscriptionCycle,
  useVatCurrencySummary,
} from '@hisabche/api'
import { useBookCurrency } from '../../../hooks/use-book-currency'
import { Button } from '../button'
import { Input } from '../input'
import { ExpressCard, ExpressResultBox } from './express-card'

export function FinanceCompliancePanel() {
  const t = useTranslations('extendedOps')
  const bookCurrency = useBookCurrency()
  const currency = bookCurrency || ''

  const vatSummary = useVatCurrencySummary()
  const bankMatch = useMatchBankTransactions()
  const fxKyc = useEvaluateFxKyc()
  const consolidate = useConsolidatedSummary()
  const changeOrder = useCreateChangeOrder()
  const contractESign = useESignContract()
  const subCycle = useScheduleSubscriptionCycle()
  const guarantee = useEvaluateContractGuarantee()
  const waitlist = useAllocateWaitlist()
  const noShow = useEvaluateNoShowFee()

  const [netMinor, setNetMinor] = useState('100000')
  const [vatMinor, setVatMinor] = useState('10000')
  const [refCode, setRefCode] = useState('TRX-1001')
  const [fxReqMinor, setFxReqMinor] = useState('100000')
  const [dailyCapMinor, setDailyCapMinor] = useState('500000')
  const [projectId, setProjectId] = useState('')
  const [changeDelta, setChangeDelta] = useState('25000')
  const [contractId, setContractId] = useState('')
  const [signerName, setSignerName] = useState('')

  return (
    <section data-extended-panel="finance-compliance" className="mt-4 space-y-3">
      <h3 className="text-base font-bold text-[hsl(var(--fg-primary))]">
        {t('finance.sectionTitle')}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ExpressCard title={t('finance.vatTitle')}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              type="number"
              inputMode="numeric"
              value={netMinor}
              onChange={(e) => setNetMinor(e.target.value)}
              placeholder={t('finance.netAmount')}
              className="min-h-[44px]"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={vatMinor}
              onChange={(e) => setVatMinor(e.target.value)}
              placeholder={t('finance.vatAmount')}
              className="min-h-[44px]"
            />
          </div>
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={!currency || vatSummary.isPending}
            onClick={() =>
              vatSummary.mutate([
                {
                  currency,
                  kind: 'sale',
                  netMinor: Math.max(0, Number(netMinor) || 0),
                  vatMinor: Math.max(0, Number(vatMinor) || 0),
                },
              ])
            }
          >
            {t('finance.computeVat')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={vatSummary.data}
            error={vatSummary.error ? apiErrorMessage(vatSummary.error, t('common.error')) : null}
          />
        </ExpressCard>

        <ExpressCard title={t('finance.bankMatchTitle')}>
          <Input
            value={refCode}
            onChange={(e) => setRefCode(e.target.value)}
            placeholder={t('finance.referenceCode')}
            className="min-h-[44px]"
          />
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={!currency || bankMatch.isPending}
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10)
              const cleanRef = refCode.trim()
              bankMatch.mutate({
                maxDateDiffDays: 3,
                feed: [
                  { id: 'feed-1', date: today, currency, amountMinor: 50000, reference: cleanRef },
                ],
                candidates: [
                  { id: 'cand-1', date: today, currency, amountMinor: 50000, reference: cleanRef },
                ],
              })
            }}
          >
            {t('finance.runBankMatch')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={bankMatch.data}
            error={bankMatch.error ? apiErrorMessage(bankMatch.error, t('common.error')) : null}
          />
        </ExpressCard>

        <ExpressCard title={t('finance.fxKycTitle')}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              type="number"
              inputMode="numeric"
              value={fxReqMinor}
              onChange={(e) => setFxReqMinor(e.target.value)}
              placeholder={t('finance.requestedAmount')}
              className="min-h-[44px]"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={dailyCapMinor}
              onChange={(e) => setDailyCapMinor(e.target.value)}
              placeholder={t('finance.dailyCap')}
              className="min-h-[44px]"
            />
          </div>
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={fxKyc.isPending}
            onClick={() =>
              fxKyc.mutate({
                dailyAccumulatedMinor: 0,
                requestedMinor: Math.max(1, Number(fxReqMinor) || 1),
                kycThresholdMinor: Math.round((Number(dailyCapMinor) || 500000) / 2),
                dailyCapMinor: Math.max(1, Number(dailyCapMinor) || 500000),
                hasVerifiedIdDocument: true,
              })
            }
          >
            {t('finance.evaluateKyc')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={fxKyc.data}
            error={fxKyc.error ? apiErrorMessage(fxKyc.error, t('common.error')) : null}
          />
        </ExpressCard>

        <ExpressCard title={t('finance.consolidateTitle')}>
          <Input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder={t('finance.projectId')}
            className="min-h-[44px]"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={changeDelta}
            onChange={(e) => setChangeDelta(e.target.value)}
            placeholder={t('finance.changeOrderDelta')}
            className="min-h-[44px]"
          />
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={!currency}
            onClick={() => {
              consolidate.mutate([
                {
                  entityId: 'hq',
                  currency,
                  revenueMinor: 500000,
                  expenseMinor: 300000,
                  intercompanyEliminationMinor: 20000,
                },
              ])
              if (projectId.trim()) {
                changeOrder.mutate({
                  projectId: projectId.trim(),
                  title: 'Change Order',
                  originalBudgetMinor: 1000000,
                  deltaMinor: Number(changeDelta) || 0,
                  estimatedCostDeltaMinor: 0,
                  approved: false,
                })
              }
            }}
          >
            {t('finance.runConsolidation')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={
              consolidate.data || changeOrder.data
                ? { consolidated: consolidate.data ?? null, changeOrder: changeOrder.data ?? null }
                : null
            }
          />
        </ExpressCard>

        <ExpressCard title={t('finance.contractEsignTitle')}>
          <Input
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            placeholder={t('finance.contractId')}
            className="min-h-[44px]"
          />
          <Input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder={t('finance.signerName')}
            className="min-h-[44px]"
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            disabled={!contractId.trim()}
            onClick={() => {
              const cid = contractId.trim()
              const today = new Date().toISOString().slice(0, 10)
              subCycle.mutate({
                contractId: cid,
                currentPeriodEnd: today,
                cycleDays: 30,
                graceDays: 5,
                amountMinor: 50000,
              })
              guarantee.mutate({
                guaranteeNumber: 'BG-01',
                amountMinor: 250000,
                contractValueMinor: 1000000,
                expiresAt: '2027-12-31',
                asOfIso: today,
              })
              if (signerName.trim().length >= 2) {
                contractESign.mutate({
                  contractId: cid,
                  signerName: signerName.trim(),
                  documentSha256: 'a'.repeat(64),
                })
              }
            }}
          >
            {t('finance.signContract')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={
              subCycle.data || guarantee.data || contractESign.data
                ? {
                    subscription: subCycle.data ?? null,
                    guarantee: guarantee.data ?? null,
                    eSign: contractESign.data ?? null,
                  }
                : null
            }
          />
        </ExpressCard>

        <ExpressCard title={t('finance.waitlistTitle')}>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            onClick={() => {
              waitlist.mutate({
                capacity: 5,
                confirmedIds: ['c1', 'c2'],
                waitlistIds: [],
                applicantId: 'c3',
              })
              noShow.mutate({
                depositMinor: 5000,
                noShowFeeMinor: 2000,
                hoursBeforeAppointment: 4,
                freeCancelWindowHours: 24,
              })
            }}
          >
            {t('finance.evaluateWaitlist')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={
              waitlist.data || noShow.data
                ? { waitlist: waitlist.data ?? null, noShowFee: noShow.data ?? null }
                : null
            }
          />
        </ExpressCard>
      </div>
    </section>
  )
}
