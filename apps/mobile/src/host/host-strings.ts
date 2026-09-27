// ============================================
// The few words the native host draws itself, in the reader's language.
//
// Everything else is the shared UI inside the WebView, translated there. These
// screens exist precisely when that UI does not: the bundle failed to unpack,
// or the camera overlay sits above it. They used to be Persian literals, so an
// English or Dari reader got Persian at the one moment something went wrong.
//
// A typed bundle rather than the shared catalogs: the three `common.json`
// files are ~935 KB, and pulling them into the native bundle to render four
// strings would cost every cold start. Same pattern as the desktop bundle
// (`packages/app-shell/src/shared/i18n/desktop-strings.ts`) — `HostStrings`
// makes each locale complete by construction.
// ============================================

import { getLocales } from 'expo-localization'
import { STORAGE_KEYS } from '@hisabche/api'

import { secureStorage } from '../shared/lib/storage'

interface HostStrings {
  openFailedTitle: string
  openFailedBody: string
  scanTitle: string
  close: string
}

export type HostLocale = 'fa' | 'af' | 'en'

export const hostStrings: Record<HostLocale, HostStrings> = {
  fa: {
    openFailedTitle: 'برنامه باز نشد',
    openFailedBody:
      'فایل‌های برنامه روی این دستگاه باز نشدند. برنامه را ببندید و دوباره باز کنید؛ اگر باز هم تکرار شد، نصب دوباره لازم است.',
    scanTitle: 'بارکد را جلوی دوربین بگیرید',
    close: 'بستن',
  },
  af: {
    openFailedTitle: 'برنامه باز نشد',
    openFailedBody:
      'فایل‌های برنامه روی این دستگاه باز نشدند. برنامه را ببندید و دوباره باز کنید؛ اگر باز هم تکرار شد، نصب دوباره ضروری است.',
    scanTitle: 'بارکد را پیش روی کمره بگیرید',
    close: 'بستن',
  },
  en: {
    openFailedTitle: 'The app could not open',
    openFailedBody:
      'The app files could not be opened on this device. Close the app and open it again; if it keeps happening, reinstall it.',
    scanTitle: 'Hold the barcode in front of the camera',
    close: 'Close',
  },
}

/**
 * The language the person chose in the app (the shared UI writes it to the
 * same secure store this host reads, warmed before first render); the device
 * language when they never chose one. Never a guess beyond those two.
 */
export function toHostLocale(tag: string | null | undefined): HostLocale {
  const value = (tag ?? '').toLowerCase()
  if (value.startsWith('en')) return 'en'
  if (value === 'af' || value.endsWith('-af') || value.startsWith('ps')) return 'af'
  return 'fa'
}

export function hostText(key: keyof HostStrings): string {
  const chosen = secureStorage.getItem(STORAGE_KEYS.language)
  const device = chosen ? null : (getLocales()[0]?.languageTag ?? null)
  return hostStrings[toHostLocale(chosen ?? device)][key]
}
