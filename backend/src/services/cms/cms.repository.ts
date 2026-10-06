import { SupabaseClient } from '@supabase/supabase-js'

import { NotFoundError } from '../../errors/database.error'

import {
  BackgroundConfig,
  ResponsiveLayout,
  ResponsiveSpacing,
  ResponsiveVisibility,
  SectionConfig,
  SectionDesign,
  TypographyConfig,
} from './cms.domain'

export interface CmsPageRow {
  id: string
  locale: string
  slug: string
  title: string
  status: 'draft' | 'published' | 'archived'
  theme: string
  seo_title: string | null
  seo_description: string | null
  seo_canonical: string | null
  seo_og_image_id: string | null
  seo_noindex: boolean
  seo_schema: Record<string, unknown>
  sections: SectionConfig[]
  published_at: string | null
  published_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CmsMediaRow {
  id: string
  filename: string
  original_filename: string
  mime_type: string
  width: number | null
  height: number | null
  size_bytes: number
  alt: string
  caption: string
  title: string
  focal_x: number
  focal_y: number
  uploaded_by: string | null
  bucket: string
  storage_path: string
  variants: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CmsGlobalRow {
  id: string
  locale: string
  key: string
  content: Record<string, unknown>
  updated_by: string | null
  updated_at: string
}

export class CmsRepository {
  constructor(private db: SupabaseClient) {}

  // ═══════════════════════════════════════════════════════════════
  // PAGES
  // ═══════════════════════════════════════════════════════════════

  async listPages(locale?: string, status?: string): Promise<CmsPageRow[]> {
    let query = this.db.from('cms_pages').select('*').order('updated_at', { ascending: false })
    if (locale) query = query.eq('locale', locale)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return data as CmsPageRow[]
  }

  async getPage(id: string): Promise<CmsPageRow> {
    const { data, error } = await this.db.from('cms_pages').select('*').eq('id', id).single()
    if (error || !data) throw new NotFoundError('CMS_PAGE_NOT_FOUND')
    return data as CmsPageRow
  }

  async getPageByUrl(locale: string, slug: string): Promise<CmsPageRow> {
    const { data, error } = await this.db
      .from('cms_pages')
      .select('*')
      .eq('locale', locale)
      .eq('slug', slug)
      .single()
    if (error || !data) throw new NotFoundError('CMS_PAGE_NOT_FOUND')
    return data as CmsPageRow
  }

  async createPage(data: Partial<CmsPageRow>): Promise<CmsPageRow> {
    const { data: page, error } = await this.db.from('cms_pages').insert(data).select('*').single()
    if (error) throw error
    return page as CmsPageRow
  }

  async updatePage(id: string, data: Partial<CmsPageRow>): Promise<CmsPageRow> {
    const { data: page, error } = await this.db
      .from('cms_pages')
      .update(data)
      .eq('id', id)
      .select('*')
      .single()
    if (error || !page) throw new NotFoundError('CMS_PAGE_NOT_FOUND')
    return page as CmsPageRow
  }

  async deletePage(id: string): Promise<void> {
    const { error, count } = await this.db.from('cms_pages').delete({ count: 'exact' }).eq('id', id)
    if (error || count === 0) throw new NotFoundError('CMS_PAGE_NOT_FOUND')
  }

  // ═══════════════════════════════════════════════════════════════
  // MEDIA
  // ═══════════════════════════════════════════════════════════════

  async listMedia(): Promise<CmsMediaRow[]> {
    const { data, error } = await this.db
      .from('cms_media')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as CmsMediaRow[]
  }

  async getMedia(id: string): Promise<CmsMediaRow> {
    const { data, error } = await this.db.from('cms_media').select('*').eq('id', id).single()
    if (error || !data) throw new NotFoundError('CMS_MEDIA_NOT_FOUND')
    return data as CmsMediaRow
  }

  async createMedia(data: Partial<CmsMediaRow>): Promise<CmsMediaRow> {
    const { data: media, error } = await this.db.from('cms_media').insert(data).select('*').single()
    if (error) throw error
    return media as CmsMediaRow
  }

  async updateMedia(id: string, data: Partial<CmsMediaRow>): Promise<CmsMediaRow> {
    const { data: media, error } = await this.db
      .from('cms_media')
      .update(data)
      .eq('id', id)
      .select('*')
      .single()
    if (error || !media) throw new NotFoundError('CMS_MEDIA_NOT_FOUND')
    return media as CmsMediaRow
  }

  async deleteMedia(id: string): Promise<void> {
    const { error, count } = await this.db.from('cms_media').delete({ count: 'exact' }).eq('id', id)
    if (error || count === 0) throw new NotFoundError('CMS_MEDIA_NOT_FOUND')
  }

  // ═══════════════════════════════════════════════════════════════
  // GLOBALS / REMOTE CONTENT SNIPPETS
  // ═══════════════════════════════════════════════════════════════

  async listGlobals(locale: string): Promise<CmsGlobalRow[]> {
    const { data, error } = await this.db.from('cms_globals').select('*').eq('locale', locale)
    if (error) throw error
    return data as CmsGlobalRow[]
  }

  async upsertGlobal(
    locale: string,
    key: string,
    content: Record<string, unknown>,
    userId: string,
  ): Promise<CmsGlobalRow> {
    const { data, error } = await this.db
      .from('cms_globals')
      .upsert(
        {
          locale,
          key,
          content,
          updated_by: userId,
        },
        { onConflict: 'locale,key' },
      )
      .select('*')
      .single()
    if (error) throw error
    return data as CmsGlobalRow
  }
}
