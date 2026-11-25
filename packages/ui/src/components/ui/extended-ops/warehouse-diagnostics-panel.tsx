'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useAllocateLandedCost,
  useCheckImei,
  useDecodeVin,
  useEvaluateFleetCompliance,
  useGenerateBarcodeLabel,
  useInspectQualityBatch,
  useReconcileCodBatch,
  useRmaDisposition,
  useScoreSupplier,
} from '@hisabche/api'
import { Button } from '../button'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { ExpressCard, ExpressResultBox } from './express-card'

export function WarehouseDiagnosticsPanel() {
  const t = useTranslations('extendedOps')

  const genBarcode = useGenerateBarcodeLabel()
  const inspectBatch = useInspectQualityBatch()
  const rmaDisposition = useRmaDisposition()
  const checkImei = useCheckImei()
  const decodeVin = useDecodeVin()
  const allocateLanded = useAllocateLandedCost()
  const scoreSupplier = useScoreSupplier()
  const reconcileCod = useReconcileCodBatch()
  const fleetCompliance = useEvaluateFleetCompliance()

  const [productId, setProductId] = useState('')
  const [productTitle, setProductTitle] = useState('')
  const [barcodeVal, setBarcodeVal] = useState('')
  const [priceLabel, setPriceLabel] = useState('')

  const [batchCode, setBatchCode] = useState('BATCH-01')
  const [inspectedQty, setInspectedQty] = useState('100')
  const [defectiveQty, setDefectiveQty] = useState('1')

  const [rmaCondition, setRmaCondition] = useState<
    'defective_doa' | 'repairable' | 'damaged_customer' | 'sealed_resellable'
  >('defective_doa')
  const [imeiInput, setImeiInput] = useState('')
  const [vinInput, setVinInput] = useState('')

  const [freightCost, setFreightCost] = useState('5000')
  const [customsCost, setCustomsCost] = useState('2500')

  const [currentKm, setCurrentKm] = useState('45000')
  const [nextServiceKm, setNextServiceKm] = useState('50000')

  return (
    <section data-extended-panel="warehouse-diagnostics" className="mt-6 space-y-3">
      <h3 className="text-base font-bold text-[hsl(var(--fg-primary))]">
        {t('warehouse.sectionTitle')}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ExpressCard title={t('warehouse.barcodeTitle')}>
          <Input
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder={t('warehouse.productId')}
            className="min-h-[44px]"
          />
          <Input
            value={productTitle}
            onChange={(e) => setProductTitle(e.target.value)}
            placeholder={t('warehouse.productTitle')}
            className="min-h-[44px]"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              value={barcodeVal}
              onChange={(e) => setBarcodeVal(e.target.value)}
              placeholder={t('warehouse.barcodeValue')}
              className="min-h-[44px]"
            />
            <Input
              value={priceLabel}
              onChange={(e) => setPriceLabel(e.target.value)}
              placeholder={t('warehouse.priceLabel')}
              className="min-h-[44px]"
            />
          </div>
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={!productId.trim() || !barcodeVal.trim() || genBarcode.isPending}
            onClick={() =>
              genBarcode.mutate({
                productId: productId.trim(),
                title: productTitle.trim() || 'Item',
                barcode: barcodeVal.trim(),
                priceLabel: priceLabel.trim() || '-',
              })
            }
          >
            {t('warehouse.generateLabel')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={genBarcode.data}
            error={genBarcode.error ? apiErrorMessage(genBarcode.error, t('common.error')) : null}
          />
        </ExpressCard>

        <ExpressCard title={t('warehouse.qualityTitle')}>
          <Input
            value={batchCode}
            onChange={(e) => setBatchCode(e.target.value)}
            placeholder={t('warehouse.batchCode')}
            className="min-h-[44px]"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              type="number"
              inputMode="numeric"
              value={inspectedQty}
              onChange={(e) => setInspectedQty(e.target.value)}
              placeholder={t('warehouse.inspectedQty')}
              className="min-h-[44px]"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={defectiveQty}
              onChange={(e) => setDefectiveQty(e.target.value)}
              placeholder={t('warehouse.defectiveQty')}
              className="min-h-[44px]"
            />
          </div>
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={inspectBatch.isPending}
            onClick={() =>
              inspectBatch.mutate({
                batchId: batchCode.trim() || 'BATCH-01',
                inspectedQty: Math.max(1, Number(inspectedQty) || 1),
                defectiveQty: Math.max(0, Number(defectiveQty) || 0),
                maxDefectBps: 200,
              })
            }
          >
            {t('warehouse.runInspection')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={inspectBatch.data}
            error={
              inspectBatch.error ? apiErrorMessage(inspectBatch.error, t('common.error')) : null
            }
          />
        </ExpressCard>

        <ExpressCard title={t('warehouse.diagnosticsTitle')}>
          <SelectField
            value={rmaCondition}
            onChange={(v) =>
              setRmaCondition(
                v as 'defective_doa' | 'repairable' | 'damaged_customer' | 'sealed_resellable',
              )
            }
            options={[
              { value: 'defective_doa', label: 'DOA (Defective on Arrival)' },
              { value: 'repairable', label: 'Repairable' },
              { value: 'damaged_customer', label: 'Customer Damaged' },
              { value: 'sealed_resellable', label: 'Sealed Resellable' },
            ]}
          />
          <Input
            value={imeiInput}
            onChange={(e) => setImeiInput(e.target.value)}
            placeholder={t('warehouse.imeiInput')}
            className="min-h-[44px]"
          />
          <Input
            value={vinInput}
            onChange={(e) => setVinInput(e.target.value)}
            placeholder={t('warehouse.vinInput')}
            className="min-h-[44px]"
          />
          <Button
            type="button"
            className="min-h-[44px] w-full"
            onClick={() => {
              rmaDisposition.mutate({ condition: rmaCondition, underWarranty: true })
              if (imeiInput.trim()) checkImei.mutate({ imei: imeiInput.trim() })
              if (vinInput.trim()) decodeVin.mutate(vinInput.trim())
            }}
          >
            {t('warehouse.checkDiagnostics')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={
              rmaDisposition.data || checkImei.data || decodeVin.data
                ? {
                    rma: rmaDisposition.data ?? null,
                    imei: checkImei.data ?? null,
                    vin: decodeVin.data ?? null,
                  }
                : null
            }
          />
        </ExpressCard>

        <ExpressCard title={t('warehouse.procurementTitle')}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              type="number"
              inputMode="numeric"
              value={freightCost}
              onChange={(e) => setFreightCost(e.target.value)}
              placeholder={t('warehouse.freightCost')}
              className="min-h-[44px]"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={customsCost}
              onChange={(e) => setCustomsCost(e.target.value)}
              placeholder={t('warehouse.customsCost')}
              className="min-h-[44px]"
            />
          </div>
          <Button
            type="button"
            className="min-h-[44px] w-full"
            onClick={() => {
              allocateLanded.mutate({
                freightMinor: Math.max(0, Number(freightCost) || 0),
                customsMinor: Math.max(0, Number(customsCost) || 0),
                insuranceMinor: 0,
                lines: [{ lineId: 'line-1', quantity: 10, lineValueMinor: 100000 }],
              })
              scoreSupplier.mutate({ totalOrders: 20, onTimeOrders: 18, defectiveOrders: 0 })
            }}
          >
            {t('warehouse.calculateLanded')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={
              allocateLanded.data || scoreSupplier.data
                ? { landed: allocateLanded.data ?? null, supplierScore: scoreSupplier.data ?? null }
                : null
            }
          />
        </ExpressCard>

        <ExpressCard title={t('warehouse.fleetTitle')}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              type="number"
              inputMode="numeric"
              value={currentKm}
              onChange={(e) => setCurrentKm(e.target.value)}
              placeholder={t('warehouse.currentKm')}
              className="min-h-[44px]"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={nextServiceKm}
              onChange={(e) => setNextServiceKm(e.target.value)}
              placeholder={t('warehouse.nextServiceKm')}
              className="min-h-[44px]"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10)
              fleetCompliance.mutate({
                currentKm: Math.max(0, Number(currentKm) || 0),
                nextServiceKm: Math.max(0, Number(nextServiceKm) || 0),
                insuranceExpiresAt: '2027-12-31',
                asOfIso: today,
              })
              reconcileCod.mutate([
                {
                  parcelId: 'sample-1',
                  collectedMinor: 10000,
                  courierFeeMinor: 500,
                  delivered: true,
                },
              ])
            }}
          >
            {t('warehouse.checkFleetCod')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={
              fleetCompliance.data || reconcileCod.data
                ? { fleet: fleetCompliance.data ?? null, cod: reconcileCod.data ?? null }
                : null
            }
          />
        </ExpressCard>
      </div>
    </section>
  )
}
