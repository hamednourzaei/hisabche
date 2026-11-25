'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useCreateLayaway,
  useQrWhatsappCatalog,
  useTableBillSummary,
  useTradeInQuote,
} from '@hisabche/api'
import { useBookCurrency } from '../../../hooks/use-book-currency'
import { Button } from '../button'
import { Input } from '../input'
import { ExpressCard, ExpressResultBox } from './express-card'

export function OrdersExpressPanel() {
  const t = useTranslations('extendedOps')
  const bookCurrency = useBookCurrency()
  const currency = bookCurrency || ''

  const tableBill = useTableBillSummary()
  const layaway = useCreateLayaway()
  const tradeIn = useTradeInQuote()
  const qrCatalog = useQrWhatsappCatalog()

  const [subtotalMinor, setSubtotalMinor] = useState('10000')
  const [serviceBps, setServiceBps] = useState('1000')
  const [tipMinor, setTipMinor] = useState('500')

  const [layawayTotal, setLayawayTotal] = useState('10000')
  const [layawayDeposit, setLayawayDeposit] = useState('2500')
  const [installmentCount, setInstallmentCount] = useState('3')

  const [newPrice, setNewPrice] = useState('50000')
  const [tradeInValue, setTradeInValue] = useState('15000')

  const [tableNumber, setTableNumber] = useState('T1')
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [pubKey, setPubKey] = useState('')

  return (
    <section data-extended-panel="orders-express" className="mt-6 space-y-3">
      <h3 className="text-base font-bold text-[hsl(var(--fg-primary))]">
        {t('orders.sectionTitle')}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ExpressCard title={t('orders.tableBillTitle')}>
          <Input
            type="number"
            inputMode="numeric"
            value={subtotalMinor}
            onChange={(e) => setSubtotalMinor(e.target.value)}
            placeholder={t('orders.subtotal')}
            className="min-h-[44px]"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={serviceBps}
            onChange={(e) => setServiceBps(e.target.value)}
            placeholder={t('orders.serviceChargeBps')}
            className="min-h-[44px]"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={tipMinor}
            onChange={(e) => setTipMinor(e.target.value)}
            placeholder={t('orders.tipAmount')}
            className="min-h-[44px]"
          />
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={tableBill.isPending}
            onClick={() =>
              tableBill.mutate({
                subtotalMinor: Math.max(0, Number(subtotalMinor) || 0),
                serviceChargeBps: Math.max(0, Number(serviceBps) || 0),
                tipMinor: Math.max(0, Number(tipMinor) || 0),
              })
            }
          >
            {t('orders.calculateTableBill')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={tableBill.data}
            error={tableBill.error ? apiErrorMessage(tableBill.error, t('common.error')) : null}
          />
        </ExpressCard>

        <ExpressCard title={t('orders.layawayTitle')}>
          <Input
            type="number"
            inputMode="numeric"
            value={layawayTotal}
            onChange={(e) => setLayawayTotal(e.target.value)}
            placeholder={t('common.amount')}
            className="min-h-[44px]"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={layawayDeposit}
            onChange={(e) => setLayawayDeposit(e.target.value)}
            placeholder={t('orders.depositAmount')}
            className="min-h-[44px]"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={installmentCount}
            onChange={(e) => setInstallmentCount(e.target.value)}
            placeholder={t('orders.installments')}
            className="min-h-[44px]"
          />
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={!currency || layaway.isPending}
            onClick={() =>
              layaway.mutate({
                totalMinor: Math.max(1, Number(layawayTotal) || 1),
                depositMinor: Math.max(1, Number(layawayDeposit) || 1),
                installmentCount: Math.max(1, Number(installmentCount) || 1),
                currency,
              })
            }
          >
            {t('orders.createLayaway')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={layaway.data}
            error={layaway.error ? apiErrorMessage(layaway.error, t('common.error')) : null}
          />
        </ExpressCard>

        <ExpressCard title={t('orders.tradeInTitle')}>
          <Input
            type="number"
            inputMode="numeric"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder={t('orders.newItemPrice')}
            className="min-h-[44px]"
          />
          <Input
            type="number"
            inputMode="numeric"
            value={tradeInValue}
            onChange={(e) => setTradeInValue(e.target.value)}
            placeholder={t('orders.tradeInValue')}
            className="min-h-[44px]"
          />
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={!currency || tradeIn.isPending}
            onClick={() =>
              tradeIn.mutate({
                newItemPriceMinor: Math.max(0, Number(newPrice) || 0),
                tradeInAppraisedMinor: Math.max(0, Number(tradeInValue) || 0),
                conditionDeductionMinor: 0,
                currency,
              })
            }
          >
            {t('orders.quoteTradeIn')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={tradeIn.data}
            error={tradeIn.error ? apiErrorMessage(tradeIn.error, t('common.error')) : null}
          />
        </ExpressCard>

        <ExpressCard title={t('orders.qrMenuTitle')}>
          <Input
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            placeholder="Table # (e.g. T1)"
            className="min-h-[44px]"
          />
          <Input
            value={whatsappPhone}
            onChange={(e) => setWhatsappPhone(e.target.value)}
            placeholder="WhatsApp (+93...)"
            className="min-h-[44px]"
          />
          <Input
            value={pubKey}
            onChange={(e) => setPubKey(e.target.value)}
            placeholder="Hisabche-Publishable-Key"
            className="min-h-[44px]"
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            disabled={!pubKey.trim() || qrCatalog.isPending}
            onClick={() =>
              qrCatalog.mutate({
                tableNumber: tableNumber.trim() || undefined,
                whatsappPhone: whatsappPhone.trim() || undefined,
                publishableKey: pubKey.trim(),
              })
            }
          >
            {t('common.submit')}
          </Button>
          <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">{t('orders.qrEndpointHint')}</p>
          <ExpressResultBox
            label={t('common.result')}
            data={qrCatalog.data}
            error={qrCatalog.error ? apiErrorMessage(qrCatalog.error, t('common.error')) : null}
          />
        </ExpressCard>
      </div>
    </section>
  )
}
