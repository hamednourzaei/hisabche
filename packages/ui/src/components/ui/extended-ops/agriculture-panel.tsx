'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toIsoDay } from '@hisabche/formatting'
import {
  apiErrorMessage,
  useCreateCropCycle,
  useCropCycles,
  useLivestockGroups,
  useRecordLivestockGroup,
} from '@hisabche/api'
import { Button } from '../button'
import { Input } from '../input'
import { ExpressCard, ExpressResultBox } from './express-card'
import { useBusinessProfile } from '../../../hooks/use-business-profile'

const AGRI_INDUSTRIES = new Set(['agriculture', 'livestock', 'seedsFertilizer', 'flowers'])

export function AgriculturePanel({ industryOnly = false }: { industryOnly?: boolean }) {
  const { profile } = useBusinessProfile()
  const t = useTranslations('extendedOps')
  const cropsQuery = useCropCycles()
  const livestockQuery = useLivestockGroups()
  const createCrop = useCreateCropCycle()
  const recordLivestock = useRecordLivestockGroup()

  const [landUnitId, setLandUnitId] = useState('')
  const [cropName, setCropName] = useState('')
  const [plantingDate, setPlantingDate] = useState('2026-04-01')

  const [category, setCategory] = useState('')
  const [headCount, setHeadCount] = useState('10')

  if (industryOnly && (!profile.primary || !AGRI_INDUSTRIES.has(profile.primary))) {
    return null
  }

  return (
    <section data-extended-panel="agriculture-ops" className="mt-4 space-y-3">
      <h3 className="text-base font-bold text-[hsl(var(--fg-primary))]">
        {t('warehouse.agriTitle')}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ExpressCard title={t('warehouse.saveCropBtn')}>
          <Input
            value={landUnitId}
            onChange={(e) => setLandUnitId(e.target.value)}
            placeholder={t('warehouse.landUnitId')}
            className="min-h-[44px]"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              value={cropName}
              onChange={(e) => setCropName(e.target.value)}
              placeholder={t('warehouse.cropName')}
              className="min-h-[44px]"
            />
            <Input
              value={plantingDate}
              onChange={(e) => setPlantingDate(e.target.value)}
              placeholder={t('warehouse.plantingDate')}
              className="min-h-[44px]"
            />
          </div>
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={!landUnitId.trim() || !cropName.trim() || createCrop.isPending}
            onClick={() =>
              createCrop.mutate({
                landUnitId: landUnitId.trim(),
                cropName: cropName.trim(),
                plantingDate: plantingDate.trim(),
              })
            }
          >
            {t('warehouse.saveCropBtn')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={createCrop.data ?? cropsQuery.data ?? null}
            error={
              createCrop.error
                ? apiErrorMessage(createCrop.error, t('common.error'))
                : cropsQuery.error
                  ? apiErrorMessage(cropsQuery.error, t('common.error'))
                  : null
            }
          />
        </ExpressCard>

        <ExpressCard title={t('warehouse.saveLivestockBtn')}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t('warehouse.livestockCategory')}
              className="min-h-[44px]"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={headCount}
              onChange={(e) => setHeadCount(e.target.value)}
              placeholder={t('warehouse.headCount')}
              className="min-h-[44px]"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            disabled={!category.trim() || recordLivestock.isPending}
            onClick={() =>
              recordLivestock.mutate({
                category: category.trim(),
                headCount: Math.max(0, Number(headCount) || 0),
                birthOrAcquisitionDate: toIsoDay(new Date()),
              })
            }
          >
            {t('warehouse.saveLivestockBtn')}
          </Button>
          <ExpressResultBox
            label={t('common.result')}
            data={recordLivestock.data ?? livestockQuery.data ?? null}
            error={
              recordLivestock.error
                ? apiErrorMessage(recordLivestock.error, t('common.error'))
                : livestockQuery.error
                  ? apiErrorMessage(livestockQuery.error, t('common.error'))
                  : null
            }
          />
        </ExpressCard>
      </div>
    </section>
  )
}
