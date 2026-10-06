'use client'

import { useEffect } from 'react'
import { useCustomizerStore } from '@hisabche/store'
import type { CustomizerGroupData } from '@hisabche/store'

export function RegisterCustomizer({ groups }: { groups: CustomizerGroupData[] }) {
  const setPageGroups = useCustomizerStore((state) => state.setPageGroups)

  useEffect(() => {
    setPageGroups(groups)
    return () => setPageGroups([])
  }, [groups, setPageGroups])

  return null
}
