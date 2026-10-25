'use client'

import { usePathname } from 'next/navigation'
import { localeOf, type AdminLocale } from '@/components/admin-shell/admin-nav'

/** The console language, read from the `[lang]` segment of the current route. */
export function useAdminLocale(): AdminLocale {
  return localeOf(usePathname())
}
