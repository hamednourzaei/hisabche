// apps/web/lib/market-api.ts
//
// The goods marketplace's public data, fetched ON THE SERVER for the
// /[lang]/market pages and the sitemap (backend: market-public.routes.ts).
//
// ⚠️ THREE DIFFERENT ANSWERS, NEVER MERGED (راهنمای سشن §۷٫۳):
//   ok           the data
//   closed       404 — the marketplace is OFF (the default), or this seller or
//                listing is not public. The page calls notFound(); nothing is
//                listed and nothing is indexed.
//   unconfigured 503 — the migration has not run. Treated as closed.
//   anything else (network, 5xx) THROWS — the render fails, nothing is cached,
//                and ISR keeps serving the last good page.
import type {
  MarketPublicList,
  MarketPublicListingDetail,
  MarketPublicSeller,
  MarketSitemap,
} from '@hisabche/api'

const API_BASE = (
  process.env.MARKET_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://api.hisabche.com/api'
)
  .trim()
  .replace(/\/+$/, '')

/** Ten minutes: how long a switched-off marketplace or a paused listing may linger. */
export const MARKET_REVALIDATE_SECONDS = 600

export const MARKET_PAGE_SIZE = 24

export type MarketResult<T> = { kind: 'ok'; data: T } | { kind: 'closed' }

export class MarketUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MarketUnavailableError'
  }
}

async function getJson<T>(path: string): Promise<MarketResult<T>> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { accept: 'application/json' },
      next: { revalidate: MARKET_REVALIDATE_SECONDS, tags: ['market'] },
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    throw new MarketUnavailableError(`market API unreachable (${path}): ${String(error)}`)
  }
  if (response.status === 404 || response.status === 503) return { kind: 'closed' }
  if (!response.ok) {
    throw new MarketUnavailableError(`market API answered ${response.status} (${path})`)
  }
  return { kind: 'ok', data: (await response.json()) as T }
}

export function fetchMarketListings(input: {
  seller?: string | undefined
}): Promise<MarketResult<MarketPublicList>> {
  const query = new URLSearchParams({ limit: String(MARKET_PAGE_SIZE) })
  if (input.seller) query.set('seller', input.seller)
  return getJson<MarketPublicList>(`/public/market/listings?${query.toString()}`)
}

export function fetchMarketSeller(slug: string): Promise<MarketResult<MarketPublicSeller>> {
  return getJson<MarketPublicSeller>(`/public/market/sellers/${encodeURIComponent(slug)}`)
}

export function fetchMarketListing(
  seller: string,
  listing: string,
): Promise<MarketResult<MarketPublicListingDetail>> {
  return getJson<MarketPublicListingDetail>(
    `/public/market/sellers/${encodeURIComponent(seller)}/listings/${encodeURIComponent(listing)}`,
  )
}

export function fetchMarketSitemap(): Promise<MarketResult<MarketSitemap>> {
  return getJson<MarketSitemap>('/public/market/sitemap')
}
