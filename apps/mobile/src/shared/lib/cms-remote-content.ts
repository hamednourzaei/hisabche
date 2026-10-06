import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { apiClient } from './api'

const CMS_CACHE_KEY = '@hisabche/cms_globals'
const CMS_ETAG_KEY = '@hisabche/cms_globals_etag'

export interface CmsGlobals {
  [key: string]: any
}

let memoryCache: CmsGlobals | null = null

export async function fetchAndCacheCmsGlobals(locale: string = 'fa') {
  try {
    const cachedEtag = await AsyncStorage.getItem(CMS_ETAG_KEY)

    const config: any = {
      validateStatus: (status: number) => (status >= 200 && status < 300) || status === 304,
    }
    if (cachedEtag) {
      config.headers = { 'If-None-Match': cachedEtag }
    }

    // Using shared apiClient ensures correct BaseURL and interceptors
    const response = await apiClient.get(`/api/public/cms/globals/${locale}`, config)

    if (response.status === 304) return // Not modified, cache is valid

    const data = response.data
    // Update memory and disk atomically
    memoryCache = data
    await AsyncStorage.setItem(CMS_CACHE_KEY, JSON.stringify(data))

    // Save ETag
    const newEtag = response.headers['etag']
    if (newEtag) await AsyncStorage.setItem(CMS_ETAG_KEY, newEtag)
  } catch (error) {
    // Network failure should not crash UI
    console.error('[CmsRemoteContent] Sync failed, keeping local cache', error)
  }
}

export async function getCachedCmsGlobals(): Promise<CmsGlobals> {
  if (memoryCache) return memoryCache
  try {
    const data = await AsyncStorage.getItem(CMS_CACHE_KEY)
    if (data) {
      memoryCache = JSON.parse(data)
      return memoryCache!
    }
  } catch (e) {
    // Corrupt cache
  }
  return {}
}

export function useCmsRemoteContent(locale: string = 'fa') {
  const [content, setContent] = useState<CmsGlobals>({})
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let mounted = true

    // 1. Load local immediately
    getCachedCmsGlobals().then((localData) => {
      if (!mounted) return
      setContent(localData)
      setIsReady(true)

      // 2. Background sync
      fetchAndCacheCmsGlobals(locale).then(() => {
        if (!mounted) return
        if (memoryCache) setContent({ ...memoryCache }) // Trigger re-render with new data
      })
    })

    return () => {
      mounted = false
    }
  }, [locale])

  return {
    content,
    isReady,
    get: (key: string, fallback?: string) => content[key] ?? fallback ?? '',
  }
}
