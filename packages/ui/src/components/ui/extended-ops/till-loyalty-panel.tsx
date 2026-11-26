'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { OFFLINE_CARD_PAYMENT_STATES } from '@hisabche/validation'
import {
  apiErrorMessage,
  useCurrentSession,
  useGiftCards,
  useIssueGiftCard,
  useIssueStoreCredit,
  useLoyaltyBalance,
  useMutateLoyaltyPoints,
  usePaymentGatewayEvents,
  usePaymentGatewayReconciliation,
  usePaymentProcessorState,
  usePosZReport,
  useRedeemGiftCard,
  useStoreCredit,
  useSubmitGatewayWebhook,
  useTransitionPaymentProcessorState,
} from '@hisabche/api'
import { useDeviceStore } from '@hisabche/store'
import { useBookCurrency } from '../../../hooks/use-book-currency'
import { Button } from '../button'
import { Input } from '../input'
import { ExpressCard, ExpressResultBox } from './express-card'

export function TillLoyaltyPanel() {
  const t = useTranslations('extendedOps')
  const bookCurrency = useBookCurrency()
  const current = useCurrentSession()
  const sessionId = (current.data as { session?: { id?: string } } | undefined)?.session?.id ?? null

  const [loadZ, setLoadZ] = useState(false)
  const zReport = usePosZReport(loadZ ? sessionId : null)

  const pinHash = useDeviceStore((s) => s.pinHash)
  const pinLocked = useDeviceStore((s) => s.pinLocked)
  const configurePin = useDeviceStore((s) => s.configurePin)
  const lockDevice = useDeviceStore((s) => s.lockDevice)
  const [pinInput, setPinInput] = useState('')

  const issueGiftCard = useIssueGiftCard()
  const redeemGiftCard = useRedeemGiftCard()
  const giftCardsQuery = useGiftCards()
  const issueStoreCredit = useIssueStoreCredit()
  const mutateLoyalty = useMutateLoyaltyPoints()
  const [cardCode, setCardCode] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [amountMinor, setAmountMinor] = useState('5000')
  const storeCreditQuery = useStoreCredit(customerId.trim() || null)
  const loyaltyBalanceQuery = useLoyaltyBalance(customerId.trim() || null)
  const [paymentIdInput, setPaymentIdInput] = useState('')
  const [gatewayName, setGatewayName] = useState('')
  const [externalRef, setExternalRef] = useState('')

  const processorState = usePaymentProcessorState(paymentIdInput.trim() || null)
  const gatewayEvents = usePaymentGatewayEvents(paymentIdInput.trim() || null)
  const gatewayReconciliation = usePaymentGatewayReconciliation()
  const transitionProcessor = useTransitionPaymentProcessorState()
  const submitWebhook = useSubmitGatewayWebhook()

  const currency = bookCurrency || ''

  return (
    <section
      data-extended-panel="till-loyalty"
      className="mx-auto mt-4 w-full max-w-6xl space-y-3 px-3 sm:px-4 lg:px-6"
    >
      <h3 className="text-base font-bold text-[hsl(var(--fg-primary))]">
        {t('till.sectionTitle')}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ExpressCard title={t('till.zReportTitle')}>
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={!sessionId || zReport.isFetching}
            onClick={() => setLoadZ(true)}
          >
            {t('till.loadZReport')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={zReport.data}
            error={zReport.error ? apiErrorMessage(zReport.error, t('common.error')) : null}
          />
        </ExpressCard>

        <ExpressCard title={t('till.pinLockTitle')}>
          <Input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder={t('till.pinPlaceholder')}
            className="min-h-[44px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-[44px] flex-1"
              disabled={pinInput.trim().length < 4}
              onClick={() => {
                configurePin(pinInput)
                setPinInput('')
              }}
            >
              {t('till.enablePin')}
            </Button>
            {pinHash ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => lockDevice()}
              >
                {pinLocked ? 'Locked' : 'Lock'}
              </Button>
            ) : null}
          </div>
          {pinHash ? (
            <p className="text-xs font-medium text-[hsl(var(--color-primary))]">
              {t('till.pinActive')}
            </p>
          ) : null}
          <div className="pt-1">
            <div className="mb-1 text-xs text-[hsl(var(--fg-secondary))]">
              {t('till.offlineCardTitle')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OFFLINE_CARD_PAYMENT_STATES.map((st) => (
                <span
                  key={st}
                  dir="ltr"
                  className="rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-2 py-0.5 font-mono text-[11px] text-[hsl(var(--fg-secondary))]"
                >
                  {st}
                </span>
              ))}
            </div>
            <div className="mt-2 space-y-2">
              <Input
                value={paymentIdInput}
                onChange={(e) => setPaymentIdInput(e.target.value)}
                placeholder={t('till.processorPaymentId')}
                className="min-h-[44px]"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  value={gatewayName}
                  onChange={(e) => setGatewayName(e.target.value)}
                  placeholder={t('till.processorGateway')}
                  className="min-h-[44px]"
                />
                <Input
                  value={externalRef}
                  onChange={(e) => setExternalRef(e.target.value)}
                  placeholder={t('till.processorRef')}
                  className="min-h-[44px]"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full"
                disabled={!paymentIdInput.trim() || transitionProcessor.isPending}
                onClick={() =>
                  transitionProcessor.mutate({
                    paymentId: paymentIdInput.trim(),
                    processorState: 'pending_capture',
                    gatewayName: gatewayName.trim() || undefined,
                    externalRef: externalRef.trim() || undefined,
                  })
                }
              >
                {t('till.processorTransitionBtn')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full"
                disabled={!paymentIdInput.trim() || submitWebhook.isPending}
                onClick={() =>
                  submitWebhook.mutate({
                    paymentId: paymentIdInput.trim(),
                    processorState: 'captured',
                    gatewayName: gatewayName.trim() || 'POS',
                    externalRef: externalRef.trim() || 'REF',
                    signature: '',
                  })
                }
              >
                {t('till.processorFetchBtn')}
              </Button>
              <ExpressResultBox
                label={t('common.result')}
                data={{
                  state: transitionProcessor.data ?? processorState.data ?? null,
                  events: gatewayEvents.data ?? null,
                  webhook: submitWebhook.data ?? null,
                  reconciliation: gatewayReconciliation.data ?? null,
                }}
                error={
                  transitionProcessor.error
                    ? apiErrorMessage(transitionProcessor.error, t('common.error'))
                    : processorState.error
                      ? apiErrorMessage(processorState.error, t('common.error'))
                      : null
                }
              />
            </div>
          </div>
        </ExpressCard>

        <ExpressCard title={t('till.giftLoyaltyTitle')}>
          <Input
            value={cardCode}
            onChange={(e) => setCardCode(e.target.value)}
            placeholder={t('till.cardCode')}
            className="min-h-[44px]"
          />
          <Input
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder={t('till.customerId')}
            className="min-h-[44px]"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={amountMinor}
            onChange={(e) => setAmountMinor(e.target.value)}
            placeholder={t('common.amount')}
            className="min-h-[44px]"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={!cardCode.trim() || !currency || issueGiftCard.isPending}
              onClick={() =>
                issueGiftCard.mutate({
                  code: cardCode.trim(),
                  currency,
                  initialBalanceMinor: Math.max(1, Number(amountMinor) || 0),
                  customerId: customerId.trim() || null,
                })
              }
            >
              {t('till.issueGiftCard')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={!customerId.trim() || !currency || issueStoreCredit.isPending}
              onClick={() =>
                issueStoreCredit.mutate({
                  customerId: customerId.trim(),
                  currency,
                  amountMinor: Math.max(1, Number(amountMinor) || 0),
                  reason: 'Store credit via Till UI',
                  idempotencyKey: `sc-${Date.now()}`,
                })
              }
            >
              {t('till.issueCredit')}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={!cardCode.trim() || !currency || redeemGiftCard.isPending}
              onClick={() =>
                redeemGiftCard.mutate({
                  code: cardCode.trim(),
                  currency,
                  amountMinor: Math.max(1, Number(amountMinor) || 0),
                  idempotencyKey: `gc-red-${Date.now()}`,
                })
              }
            >
              {t('till.redeemGiftCard')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={!customerId.trim() || mutateLoyalty.isPending}
              onClick={() =>
                mutateLoyalty.mutate({
                  customerId: customerId.trim(),
                  kind: 'earn',
                  points: 100,
                  reason: 'POS loyalty award',
                  idempotencyKey: `loy-${Date.now()}`,
                })
              }
            >
              {t('till.addLoyaltyPoints')}
            </Button>
          </div>
          <ExpressResultBox
            label={t('common.result')}
            data={{
              action:
                issueGiftCard.data ??
                redeemGiftCard.data ??
                issueStoreCredit.data ??
                mutateLoyalty.data ??
                null,
              giftCardsCount: giftCardsQuery.data?.length ?? null,
              storeCredit: storeCreditQuery.data ?? null,
              loyalty: loyaltyBalanceQuery.data ?? null,
            }}
            error={
              issueGiftCard.error ||
              redeemGiftCard.error ||
              issueStoreCredit.error ||
              mutateLoyalty.error
                ? apiErrorMessage(
                    issueGiftCard.error ??
                      redeemGiftCard.error ??
                      issueStoreCredit.error ??
                      mutateLoyalty.error,
                    t('common.error'),
                  )
                : null
            }
          />
        </ExpressCard>
      </div>
    </section>
  )
}
