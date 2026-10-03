// ============================================
// backend/src/services/market/market.service.ts
//
// The goods marketplace (docs/goods-marketplace-01-migration.sql):
// INFRASTRUCTURE, OFF BY DEFAULT. Three audiences, three sets of methods:
//
//   public   what anyone may read — only while the platform switch is on, and
//            only a listing whose seller, listing and product are all live.
//   seller   one business's own profile and listings (TenancyContext).
//   admin    the switch, and suspending / verifying.
//
// ⚠️ NO COST EVER LEAVES HERE. The public columns are named one by one below;
// `buy_price` and every cost field are simply not among them, and the product
// is embedded for two facts only: is it active, and its cover image.
//
// ⚠️ THE PRICE IS THE SELLER'S, STATED EXPLICITLY (price_minor + currency). It
// is never derived from the product's sell price, so a listing cannot change
// because someone edited an invoice price.
//
// There is no ordering or payment here — see the design in
// .claude/research/ecosystem-gap-analysis.md §10.
// ============================================

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { DatabaseError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'

export const MARKET_SWITCH = 'goods_marketplace_enabled'

export class MarketError extends BaseError {
  constructor(code: string, statusCode: number) {
    super(code, statusCode)
    this.name = 'MarketError'
  }
}

type PgError = { code?: string; message?: string; details?: string } | null

/** The tables are absent: the migration has not run. */
function notConfigured(error: PgError): boolean {
  return !!error && ['42P01', 'PGRST205', 'PGRST200'].includes(error.code ?? '')
}

/** A database refusal as the HTTP error it means; anything else is a 500. */
export function marketFailure(error: NonNullable<PgError>, fallback: string): Error {
  if (notConfigured(error)) return new MarketError('MARKET_NOT_CONFIGURED', 503)
  const text = `${error.message ?? ''} ${error.details ?? ''}`
  if (text.includes('MARKET_PRODUCT_NOT_FOUND'))
    return new MarketError('MARKET_PRODUCT_NOT_FOUND', 404)
  if (error.code === '23505') {
    if (text.includes('marketplace_listings_slug_key'))
      return new MarketError('MARKET_LISTING_SLUG_TAKEN', 409)
    if (text.includes('marketplace_listings_product_key'))
      return new MarketError('MARKET_PRODUCT_ALREADY_LISTED', 409)
    return new MarketError('MARKET_SLUG_TAKEN', 409)
  }
  // A listing with no seller profile behind it.
  if (error.code === '23503') return new MarketError('MARKET_SELLER_REQUIRED', 409)
  return new DatabaseError(fallback, error)
}

// ─── Shapes ────────────────────────────────────────────────────────────────

export interface PublicSeller {
  slug: string
  name: string
  description: string
  city: string
  country: string
  contact: string
  verified: boolean
}

export interface PublicListing {
  slug: string
  title: string
  description: string
  priceMinor: number
  currency: string
  availability: 'in_stock' | 'out_of_stock'
  /** Only when the seller chose to state it. */
  quantity: number | null
  imageUrl: string | null
  seoTitle: string
  seoDescription: string
  updatedAt: string
  seller: Pick<PublicSeller, 'slug' | 'name' | 'city' | 'country' | 'verified'>
}

export interface PublicListingDetail extends PublicListing {
  images: Array<{ url: string; altText: string }>
  seller: PublicSeller
}

export interface SellerProfile extends PublicSeller {
  workspaceId: string
  status: 'active' | 'suspended'
  suspendedReason: string | null
}

export interface SellerProfileInput {
  slug: string
  name: string
  description: string
  city: string
  country: string
  contact: string
}

export interface Listing {
  id: string
  productId: string
  slug: string
  title: string
  description: string
  priceMinor: number
  currency: string
  availability: 'in_stock' | 'out_of_stock'
  quantity: number | null
  isHidden: boolean
  status: 'draft' | 'active' | 'paused'
  suspended: boolean
  suspendedReason: string | null
  seoTitle: string
  seoDescription: string
  updatedAt: string
}

export interface ListingInput {
  productId: string
  slug: string
  title: string
  description: string
  priceMinor: number
  currency: string
  availability: 'in_stock' | 'out_of_stock'
  quantity: number | null
  isHidden: boolean
  status: 'draft' | 'active' | 'paused'
  seoTitle: string
  seoDescription: string
}

// ─── Columns — the public ones are an explicit, closed list ────────────────

const SELLER_PUBLIC = 'slug, name, description, city, country, contact, verified'
const SELLER_COLUMNS = `workspace_id, ${SELLER_PUBLIC}, status, suspended_reason`

/** What the public may see of a listing. No cost, no buy price, no internal id. */
export const PUBLIC_LISTING_SELECT =
  'slug, title, description, price_minor, currency, availability, quantity, seo_title, seo_description, updated_at, product_id, ' +
  `seller:seller_profiles!inner(${SELLER_PUBLIC}, status), ` +
  'product:products!inner(is_active, image_url)'

const LISTING_COLUMNS =
  'id, product_id, slug, title, description, price_minor, currency, availability, quantity, is_hidden, status, suspended_at, suspended_reason, seo_title, seo_description, updated_at'

type Row = Record<string, unknown>

const toPublicSeller = (r: Row): PublicSeller => ({
  slug: String(r.slug),
  name: String(r.name),
  description: String(r.description ?? ''),
  city: String(r.city ?? ''),
  country: String(r.country ?? ''),
  contact: String(r.contact ?? ''),
  verified: r.verified === true,
})

const toSeller = (r: Row): SellerProfile => ({
  ...toPublicSeller(r),
  workspaceId: String(r.workspace_id),
  status: r.status === 'suspended' ? 'suspended' : 'active',
  suspendedReason: (r.suspended_reason as string | null) ?? null,
})

function toPublicListing(r: Row): PublicListing & { productId: string; sellerFull: PublicSeller } {
  const seller = toPublicSeller(r.seller as Row)
  const product = r.product as Row
  return {
    slug: String(r.slug),
    title: String(r.title),
    description: String(r.description ?? ''),
    priceMinor: Number(r.price_minor),
    currency: String(r.currency),
    availability: r.availability === 'out_of_stock' ? 'out_of_stock' : 'in_stock',
    quantity: r.quantity === null || r.quantity === undefined ? null : Number(r.quantity),
    imageUrl: (product.image_url as string | null) || null,
    seoTitle: String(r.seo_title ?? ''),
    seoDescription: String(r.seo_description ?? ''),
    updatedAt: String(r.updated_at),
    seller: {
      slug: seller.slug,
      name: seller.name,
      city: seller.city,
      country: seller.country,
      verified: seller.verified,
    },
    productId: String(r.product_id),
    sellerFull: seller,
  }
}

/** The public shape only — the product id used to find images stays here. */
function publicOnly(row: ReturnType<typeof toPublicListing>): PublicListing {
  const { productId: _productId, sellerFull: _sellerFull, ...listing } = row
  return listing
}

const toListing = (r: Row): Listing => ({
  id: String(r.id),
  productId: String(r.product_id),
  slug: String(r.slug),
  title: String(r.title),
  description: String(r.description ?? ''),
  priceMinor: Number(r.price_minor),
  currency: String(r.currency),
  availability: r.availability === 'out_of_stock' ? 'out_of_stock' : 'in_stock',
  quantity: r.quantity === null || r.quantity === undefined ? null : Number(r.quantity),
  isHidden: r.is_hidden === true,
  status: r.status === 'active' ? 'active' : r.status === 'paused' ? 'paused' : 'draft',
  suspended: Boolean(r.suspended_at),
  suspendedReason: (r.suspended_reason as string | null) ?? null,
  seoTitle: String(r.seo_title ?? ''),
  seoDescription: String(r.seo_description ?? ''),
  updatedAt: String(r.updated_at),
})

const listingRow = (input: ListingInput) => ({
  product_id: input.productId,
  slug: input.slug,
  title: input.title,
  description: input.description,
  price_minor: input.priceMinor,
  currency: input.currency,
  availability: input.availability,
  quantity: input.quantity,
  is_hidden: input.isHidden,
  status: input.status,
  seo_title: input.seoTitle,
  seo_description: input.seoDescription,
})

export class MarketService {
  // ─── The switch ─────────────────────────────────────────────────────────

  /** Is the marketplace on? A missing row is OFF (the explicit default). */
  async isEnabled(): Promise<boolean> {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', MARKET_SWITCH)
      .maybeSingle()
    if (error) throw marketFailure(error, 'Failed to read the marketplace switch')
    return (data as { value?: unknown } | null)?.value === true
  }

  /** Public reads answer 404 while the marketplace is off — it does not exist yet. */
  private async assertPublic(): Promise<void> {
    if (!(await this.isEnabled())) throw new MarketError('MARKET_DISABLED', 404)
  }

  /** Seller writes are refused while off; the seller screen says why. */
  private async assertOpenForSellers(): Promise<void> {
    if (!(await this.isEnabled())) throw new MarketError('MARKET_DISABLED', 409)
  }

  // ─── Public ─────────────────────────────────────────────────────────────

  /** The one rule of «public», applied to every public listing read. */
  private publicListings() {
    return supabase
      .from('marketplace_listings')
      .select(PUBLIC_LISTING_SELECT, { count: 'exact' })
      .eq('status', 'active')
      .eq('is_hidden', false)
      .is('suspended_at', null)
      .eq('seller.status', 'active')
      .eq('product.is_active', true)
  }

  async listPublic(input: {
    seller?: string | undefined
    search?: string | undefined
    limit: number
    offset: number
  }): Promise<{ listings: PublicListing[]; total: number }> {
    await this.assertPublic()
    let query = this.publicListings()
      .order('updated_at', { ascending: false })
      .order('slug', { ascending: true })
      .range(input.offset, input.offset + input.limit - 1)
    if (input.seller) query = query.eq('seller.slug', input.seller)
    // Letters, digits and spaces only reach ilike — nothing that is syntax.
    const search = (input.search ?? '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim()
    if (search) query = query.ilike('title', `%${search}%`)
    const { data, error, count } = await query
    if (error) throw marketFailure(error, 'Failed to read the marketplace')
    return {
      listings: ((data ?? []) as unknown as Row[]).map((r) => publicOnly(toPublicListing(r))),
      total: count ?? 0,
    }
  }

  async sellerPublic(slug: string): Promise<PublicSeller> {
    await this.assertPublic()
    const { data, error } = await supabase
      .from('seller_profiles')
      .select(SELLER_PUBLIC)
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle()
    if (error) throw marketFailure(error, 'Failed to read the seller')
    if (!data) throw new MarketError('MARKET_SELLER_NOT_FOUND', 404)
    return toPublicSeller(data as unknown as Row)
  }

  async listingPublic(sellerSlug: string, listingSlug: string): Promise<PublicListingDetail> {
    await this.assertPublic()
    const { data, error } = await this.publicListings()
      .eq('seller.slug', sellerSlug)
      .eq('slug', listingSlug)
      .maybeSingle()
    if (error) throw marketFailure(error, 'Failed to read the listing')
    if (!data) throw new MarketError('MARKET_LISTING_NOT_FOUND', 404)
    const row = toPublicListing(data as unknown as Row)

    // The gallery, when product images are set up; the cover alone otherwise.
    const gallery = await supabase
      .from('product_images')
      .select('url, alt_text')
      .eq('product_id', row.productId)
      .order('position', { ascending: true })
    if (gallery.error && !notConfigured(gallery.error)) {
      throw new DatabaseError('Failed to read the listing images', gallery.error)
    }
    const images = (gallery.data ?? []).map((image) => ({
      url: String(image.url),
      altText: String(image.alt_text ?? ''),
    }))
    return {
      ...publicOnly(row),
      seller: row.sellerFull,
      images:
        images.length > 0 || !row.imageUrl ? images : [{ url: row.imageUrl, altText: row.title }],
    }
  }

  /** Every public URL, for the sitemap. Empty (not an error) while off. */
  async sitemap(): Promise<{
    enabled: boolean
    sellers: Array<{ slug: string }>
    listings: Array<{ seller: string; slug: string; updatedAt: string }>
  }> {
    if (!(await this.isEnabled())) return { enabled: false, sellers: [], listings: [] }
    const rows: Row[] = []
    // Paged to the end: a sitemap that stops at one page hides the rest (§7.4).
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.publicListings()
        .order('slug', { ascending: true })
        .range(from, from + 999)
      if (error) throw marketFailure(error, 'Failed to read the marketplace sitemap')
      rows.push(...((data ?? []) as unknown as Row[]))
      if (!data || data.length < 1000) break
    }
    const listings = rows.map((r) => ({
      seller: String((r.seller as Row).slug),
      slug: String(r.slug),
      updatedAt: String(r.updated_at),
    }))
    return {
      enabled: true,
      sellers: [...new Set(listings.map((l) => l.seller))].map((slug) => ({ slug })),
      listings,
    }
  }

  // ─── The seller (one business) ──────────────────────────────────────────

  async sellerOverview(
    ctx: TenancyContext,
  ): Promise<{ enabled: boolean; profile: SellerProfile | null; listings: Listing[] }> {
    const [enabled, profile, listings] = await Promise.all([
      this.isEnabled(),
      supabase
        .from('seller_profiles')
        .select(SELLER_COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
        .maybeSingle(),
      supabase
        .from('marketplace_listings')
        .select(LISTING_COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
        .order('updated_at', { ascending: false }),
    ])
    if (profile.error) throw marketFailure(profile.error, 'Failed to read the seller profile')
    if (listings.error) throw marketFailure(listings.error, 'Failed to read the listings')
    return {
      enabled,
      profile: profile.data ? toSeller(profile.data as unknown as Row) : null,
      listings: ((listings.data ?? []) as unknown as Row[]).map(toListing),
    }
  }

  /**
   * Create or update this business's profile.
   *
   * ⚠️ Only the seller's own fields are written. `status`, `verified` and the
   * suspension reason are the platform's and are not in this object at all.
   */
  async saveProfile(ctx: TenancyContext, input: SellerProfileInput): Promise<SellerProfile> {
    await this.assertOpenForSellers()
    const { data, error } = await supabase
      .from('seller_profiles')
      .upsert(
        {
          workspace_id: ctx.workspaceId,
          slug: input.slug,
          name: input.name,
          description: input.description,
          city: input.city,
          country: input.country,
          contact: input.contact,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id' },
      )
      .select(SELLER_COLUMNS)
      .single()
    if (error) throw marketFailure(error, 'Failed to save the seller profile')
    return toSeller(data as unknown as Row)
  }

  async createListing(ctx: TenancyContext, input: ListingInput): Promise<Listing> {
    await this.assertOpenForSellers()
    const { data, error } = await supabase
      .from('marketplace_listings')
      .insert({ ...listingRow(input), workspace_id: ctx.workspaceId })
      .select(LISTING_COLUMNS)
      .single()
    if (error) throw marketFailure(error, 'Failed to create the listing')
    return toListing(data as unknown as Row)
  }

  async updateListing(ctx: TenancyContext, id: string, input: ListingInput): Promise<Listing> {
    await this.assertOpenForSellers()
    const { data, error } = await supabase
      .from('marketplace_listings')
      .update(listingRow(input))
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .select(LISTING_COLUMNS)
      .maybeSingle()
    if (error) throw marketFailure(error, 'Failed to save the listing')
    if (!data) throw new MarketError('MARKET_LISTING_NOT_FOUND', 404)
    return toListing(data as unknown as Row)
  }

  async deleteListing(ctx: TenancyContext, id: string): Promise<void> {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .delete()
      .eq('id', id)
      .eq('workspace_id', ctx.workspaceId)
      .select('id')
      .maybeSingle()
    if (error) throw marketFailure(error, 'Failed to delete the listing')
    if (!data) throw new MarketError('MARKET_LISTING_NOT_FOUND', 404)
  }

  // ─── The platform admin ─────────────────────────────────────────────────

  async setEnabled(adminId: string, enabled: boolean): Promise<boolean> {
    const { error } = await supabase.from('platform_settings').upsert(
      {
        key: MARKET_SWITCH,
        value: enabled,
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
    if (error) throw marketFailure(error, 'Failed to change the marketplace switch')
    return enabled
  }

  async adminSellers(q: string): Promise<SellerProfile[]> {
    let query = supabase.from('seller_profiles').select(SELLER_COLUMNS).order('name').limit(100)
    const search = q.replace(/[^\p{L}\p{N} -]/gu, ' ').trim()
    if (search) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
    const { data, error } = await query
    if (error) throw marketFailure(error, 'Failed to read the sellers')
    return ((data ?? []) as unknown as Row[]).map(toSeller)
  }

  async setSellerStatus(
    workspaceId: string,
    status: 'active' | 'suspended',
    reason: string | null,
  ): Promise<SellerProfile> {
    const { data, error } = await supabase
      .from('seller_profiles')
      .update({
        status,
        suspended_reason: status === 'suspended' ? reason : null,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .select(SELLER_COLUMNS)
      .maybeSingle()
    if (error) throw marketFailure(error, 'Failed to change the seller status')
    if (!data) throw new MarketError('MARKET_SELLER_NOT_FOUND', 404)
    return toSeller(data as unknown as Row)
  }

  async setSellerVerified(
    adminId: string,
    workspaceId: string,
    verified: boolean,
  ): Promise<SellerProfile> {
    const { data, error } = await supabase
      .from('seller_profiles')
      .update({
        verified,
        verified_at: verified ? new Date().toISOString() : null,
        verified_by: verified ? adminId : null,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .select(SELLER_COLUMNS)
      .maybeSingle()
    if (error) throw marketFailure(error, 'Failed to change the seller verification')
    if (!data) throw new MarketError('MARKET_SELLER_NOT_FOUND', 404)
    return toSeller(data as unknown as Row)
  }

  async adminListings(
    workspaceId: string | undefined,
  ): Promise<Array<Listing & { workspaceId: string }>> {
    let query = supabase
      .from('marketplace_listings')
      .select(`workspace_id, ${LISTING_COLUMNS}`)
      .order('updated_at', { ascending: false })
      .limit(200)
    if (workspaceId) query = query.eq('workspace_id', workspaceId)
    const { data, error } = await query
    if (error) throw marketFailure(error, 'Failed to read the listings')
    return ((data ?? []) as unknown as Row[]).map((r) => ({
      ...toListing(r),
      workspaceId: String(r.workspace_id),
    }))
  }

  async setListingSuspended(
    id: string,
    suspended: boolean,
    reason: string | null,
  ): Promise<Listing> {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .update({
        suspended_at: suspended ? new Date().toISOString() : null,
        suspended_reason: suspended ? reason : null,
      })
      .eq('id', id)
      .select(LISTING_COLUMNS)
      .maybeSingle()
    if (error) throw marketFailure(error, 'Failed to change the listing suspension')
    if (!data) throw new MarketError('MARKET_LISTING_NOT_FOUND', 404)
    return toListing(data as unknown as Row)
  }
}

export const marketService = new MarketService()
