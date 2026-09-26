'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, asList } from '@hisabche/api'
import type {
  BlogCommentStatus,
  BlogFaqItem,
  BlogLocale,
  BlogPostStatus,
} from '@hisabche/validation'

/**
 * Blog authoring — platform admin only.
 *
 * Endpoints (backend/src/routes/blog.routes.ts, all behind authenticate +
 * platformAdminGuard):
 *
 *   GET    /admin/blog/posts?locale=&status=&q=&page=&pageSize=
 *   GET    /admin/blog/posts/:id
 *   POST   /admin/blog/posts            → { post, warnings, revalidated }
 *   PUT    /admin/blog/posts/:id        → { post, warnings, revalidated }
 *   DELETE /admin/blog/posts/:id
 *   GET|POST /admin/blog/:kind          kind = categories | tags
 *   PUT|DELETE /admin/blog/:kind/:id
 *   GET    /admin/blog/comments?status=&page=
 *   PATCH  /admin/blog/comments/:id     { status }
 *   POST   /admin/blog/images           { fileName, mimeType, contentBase64 } → { url }
 *
 * The HTML the editor produces is sanitised by the SERVER on every save; what
 * comes back in `post.contentHtml` is what the site will show.
 */

export interface AdminBlogStats {
  likes: number
  dislikes: number
  ratingCount: number
  ratingAvg: number | null
  comments: number
  pendingComments: number
  views: number
}

export interface AdminBlogPostSummary {
  id: string
  locale: BlogLocale
  slug: string
  title: string
  excerpt: string
  coverUrl: string | null
  coverAlt: string | null
  publishedAt: string | null
  updatedAt: string
  readingMinutes: number
  category: { slug: string; name: string } | null
  tags: Array<{ slug: string; name: string }>
  status: BlogPostStatus
  noindex: boolean
  translationGroupId: string
  stats: AdminBlogStats
}

export interface AdminBlogPost extends AdminBlogPostSummary {
  contentJson: Record<string, unknown>
  contentHtml: string
  faq: BlogFaqItem[]
  metaTitle: string | null
  metaDescription: string | null
  focusKeyword: string | null
  keywords: string[]
  canonicalUrl: string | null
  ogImageUrl: string | null
  categoryId: string | null
  tagIds: string[]
  authorName: string | null
  translations: Array<{
    id: string
    locale: BlogLocale
    slug: string
    title: string
    status: BlogPostStatus
  }>
}

export interface BlogSaveInput {
  locale: BlogLocale
  slug: string
  title: string
  excerpt: string | null
  contentJson: Record<string, unknown>
  contentHtml: string
  faq: BlogFaqItem[]
  coverUrl: string | null
  coverAlt: string | null
  metaTitle: string | null
  metaDescription: string | null
  focusKeyword: string | null
  keywords: string[]
  canonicalUrl: string | null
  ogImageUrl: string | null
  noindex: boolean
  status: BlogPostStatus
  publishedAt: string | null
  categoryId: string | null
  tagIds: string[]
  translationGroupId: string | null
}

export interface BlogSaveResult {
  post: AdminBlogPost
  warnings: Array<{ path: string; message: string }>
  revalidated: 'sent' | 'disabled' | 'failed'
}

export interface AdminBlogTaxonomy {
  id: string
  locale: BlogLocale
  slug: string
  name: string
  description?: string | null
}

export interface AdminBlogComment {
  id: string
  parentId: string | null
  body: string
  createdAt: string
  status: BlogCommentStatus
  authorName: string | null
  post: { id: string; title: string; locale: BlogLocale; slug: string } | null
}

export type BlogTaxonomyKind = 'categories' | 'tags'

export const adminBlogKeys = {
  all: ['admin', 'blog'] as const,
  posts: (params: Record<string, unknown>) => [...adminBlogKeys.all, 'posts', params] as const,
  post: (id: string) => [...adminBlogKeys.all, 'post', id] as const,
  taxonomy: (kind: BlogTaxonomyKind, locale: string) =>
    [...adminBlogKeys.all, kind, locale] as const,
  comments: (status: string, page: number) =>
    [...adminBlogKeys.all, 'comments', status, page] as const,
}

export function useAdminBlogPosts(params: {
  locale?: BlogLocale | undefined
  status?: BlogPostStatus | undefined
  q?: string | undefined
  /** Zero-based, like the admin Pagination. */
  page: number
  pageSize: number
}) {
  return useQuery({
    queryKey: adminBlogKeys.posts(params),
    queryFn: async () => {
      const { data } = await apiClient.get<{ posts: AdminBlogPostSummary[]; total: number }>(
        '/admin/blog/posts',
        {
          params: {
            ...(params.locale ? { locale: params.locale } : {}),
            ...(params.status ? { status: params.status } : {}),
            ...(params.q ? { q: params.q } : {}),
            page: params.page + 1,
            pageSize: params.pageSize,
          },
        },
      )
      return { posts: asList<AdminBlogPostSummary>(data?.posts), total: data?.total ?? 0 }
    },
    placeholderData: keepPreviousData,
  })
}

export function useAdminBlogPost(id: string | null) {
  return useQuery({
    queryKey: adminBlogKeys.post(id ?? 'new'),
    queryFn: async () => {
      const { data } = await apiClient.get<AdminBlogPost>(`/admin/blog/posts/${id}`)
      return data
    },
    enabled: id !== null,
  })
}

export function useSaveBlogPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string | null; input: BlogSaveInput }) => {
      const { data } = id
        ? await apiClient.put<BlogSaveResult>(`/admin/blog/posts/${id}`, input)
        : await apiClient.post<BlogSaveResult>('/admin/blog/posts', input)
      return data
    },
    onSuccess: (result) => {
      queryClient.setQueryData(adminBlogKeys.post(result.post.id), result.post)
      void queryClient.invalidateQueries({ queryKey: [...adminBlogKeys.all, 'posts'] })
    },
  })
}

export function useDeleteBlogPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<{ revalidated: string }>(`/admin/blog/posts/${id}`)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminBlogKeys.all })
    },
  })
}

export function useBlogTaxonomy(kind: BlogTaxonomyKind, locale: BlogLocale) {
  return useQuery({
    queryKey: adminBlogKeys.taxonomy(kind, locale),
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: AdminBlogTaxonomy[] }>(`/admin/blog/${kind}`, {
        params: { locale },
      })
      return asList<AdminBlogTaxonomy>(data?.items)
    },
  })
}

export function useSaveBlogTaxonomy(kind: BlogTaxonomyKind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string | null
      locale: BlogLocale
      slug: string
      name: string
      description: string | null
    }) => {
      const body = {
        locale: input.locale,
        slug: input.slug,
        name: input.name,
        description: input.description,
      }
      const { data } = input.id
        ? await apiClient.put<{ item: AdminBlogTaxonomy }>(`/admin/blog/${kind}/${input.id}`, body)
        : await apiClient.post<{ item: AdminBlogTaxonomy }>(`/admin/blog/${kind}`, body)
      return data.item
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...adminBlogKeys.all, kind] })
    },
  })
}

export function useDeleteBlogTaxonomy(kind: BlogTaxonomyKind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/blog/${kind}/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...adminBlogKeys.all, kind] })
    },
  })
}

export function useBlogCommentQueue(status: BlogCommentStatus, page: number, pageSize: number) {
  return useQuery({
    queryKey: adminBlogKeys.comments(status, page),
    queryFn: async () => {
      const { data } = await apiClient.get<{ comments: AdminBlogComment[]; total: number }>(
        '/admin/blog/comments',
        {
          params: { status, page: page + 1, pageSize },
        },
      )
      return { comments: asList<AdminBlogComment>(data?.comments), total: data?.total ?? 0 }
    },
    placeholderData: keepPreviousData,
  })
}

export function useModerateBlogComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: 'approved' | 'rejected' | 'spam'
    }) => {
      const { data } = await apiClient.patch(`/admin/blog/comments/${id}`, { status })
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...adminBlogKeys.all, 'comments'] })
      void queryClient.invalidateQueries({ queryKey: [...adminBlogKeys.all, 'posts'] })
    },
  })
}

/** Reads the file in the browser and uploads it; the server checks its bytes. */
export function useUploadBlogImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const buffer = await file.arrayBuffer()
      let binary = ''
      const bytes = new Uint8Array(buffer)
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      }
      const { data } = await apiClient.post<{ url: string }>('/admin/blog/images', {
        fileName: file.name,
        mimeType: file.type,
        contentBase64: btoa(binary),
      })
      return data.url
    },
  })
}
