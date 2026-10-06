import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../lib/client'
import { readStorage, writeStorage } from '../../storage'

export interface CmsGlobals {
  [key: string]: any
}

// 1 hour memory TTL to avoid reading from disk on every render mount
const memoryCache: Record<string, { etag: string | null; data: CmsGlobals; timestamp: number }> = {}

/**
 * Hook to consume Cross-Platform Remote Content (CMS Globals).
 * Operates on a background-sync/offline-first contract:
 * 1. Reads from fast local cache immediately.
 * 2. Fetches from Network in background (stale-while-revalidate).
 * 3. Never throws/crashes on network error.
 */
export function useCmsRemoteContent(locale: string = 'fa') {
  const query = useQuery({
    queryKey: ['cms-globals', locale],
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      const cacheKey = `cms-globals-${locale}`
      const etagKey = `cms-globals-etag-${locale}`

      const cachedEtag = readStorage(etagKey)
      let initialData: CmsGlobals | null = null

      // Memory fast-path
      const mem = memoryCache[locale]
      if (mem && Date.now() - mem.timestamp < 3600000) {
        initialData = mem.data
      } else {
        const diskCache = readStorage(cacheKey)
        if (diskCache) {
          try {
            initialData = JSON.parse(diskCache)
            memoryCache[locale] = { etag: cachedEtag, data: initialData!, timestamp: Date.now() }
          } catch (e) {
            // corrupt cache
          }
        }
      }

      try {
        const config: any = {
          validateStatus: (status: number) => (status >= 200 && status < 300) || status === 304,
        }
        if (cachedEtag) {
          config.headers = { 'If-None-Match': cachedEtag }
        }

        const response = await apiClient.get(`/api/public/cms/globals/${locale}`, config)

        if (response.status === 304) {
          return initialData || {} // Not modified
        }

        const data = response.data
        writeStorage(cacheKey, JSON.stringify(data))

        const newEtag = response.headers['etag']
        if (newEtag) writeStorage(etagKey, newEtag)

        memoryCache[locale] = { etag: newEtag || null, data, timestamp: Date.now() }
        return data as CmsGlobals
      } catch (error) {
        // Network failure should not crash UI
        console.error('[CmsRemoteContent] Sync failed, keeping local cache', error)
        return initialData || {}
      }
    },
    // Prevent standard suspense/error-boundary triggers, we want silent fallback
    throwOnError: false,
  })

  // Read immediately from memory if available to prevent layout shift
  let immediateData: CmsGlobals = {}
  const mem = memoryCache[locale]
  if (mem) {
    immediateData = mem.data
  }

  const content = query.data || immediateData

  return {
    content,
    isReady: query.isSuccess || Object.keys(content).length > 0,
    get: (key: string, fallback?: string) => content[key] ?? fallback ?? '',
  }
}
