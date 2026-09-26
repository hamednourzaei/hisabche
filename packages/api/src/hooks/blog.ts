'use client'

// ============================================
// packages/api/src/hooks/blog.ts
//
// The blog as a reader's browser uses it: comments, likes, stars, the view
// beacon. Reading the articles themselves happens on the web SERVER
// (apps/web/lib/blog-api.ts) — this file is only the interactive island.
//
// ⚠️ PERSON-SCOPED BY THE SERVER. No request here carries a user id: the
// backend takes it from the token, so a client cannot like or comment as
// somebody else.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'

export type BlogLocaleCode = 'fa' | 'af' | 'en'

export interface BlogTaxonomyRef {
  slug: string
  name: string
}

/** Same shape as BlogPostSummary in backend/src/services/blog/blog.service.ts. */
export interface BlogPostSummary {
  id: string
  locale: BlogLocaleCode
  slug: string
  title: string
  excerpt: string
  coverUrl: string | null
  coverAlt: string | null
  publishedAt: string | null
  updatedAt: string
  readingMinutes: number
  category: BlogTaxonomyRef | null
  tags: BlogTaxonomyRef[]
}

export interface BlogPublicStats {
  likes: number
  dislikes: number
  ratingCount: number
  /** null when nobody has rated — never 0, which would read as a rating. */
  ratingAvg: number | null
  comments: number
}

export interface BlogPostPublic extends BlogPostSummary {
  contentHtml: string
  toc: Array<{ id: string; text: string; level: number }>
  faq: Array<{ q: string; a: string }>
  metaTitle: string | null
  metaDescription: string | null
  focusKeyword: string | null
  keywords: string[]
  canonicalUrl: string | null
  ogImageUrl: string | null
  noindex: boolean
  author: { name: string } | null
  translations: Array<{ locale: BlogLocaleCode; slug: string }>
  related: BlogPostSummary[]
  stats: BlogPublicStats
}

export interface BlogListResponse {
  posts: BlogPostSummary[]
  total: number
  page: number
  pageSize: number
  category: (BlogTaxonomyRef & { description: string | null }) | null
  tag: BlogTaxonomyRef | null
}

export interface BlogSitemapResponse {
  posts: Array<{
    locale: BlogLocaleCode
    slug: string
    updatedAt: string
    translations: Array<{ locale: BlogLocaleCode; slug: string }>
  }>
  categories: Array<{ locale: BlogLocaleCode; slug: string; updatedAt: string }>
  tags: Array<{ locale: BlogLocaleCode; slug: string; postCount: number }>
}

export interface BlogComment {
  id: string
  parentId: string | null
  body: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected' | 'spam'
  /** null when the commenter has no profile name. */
  authorName: string | null
}

export interface BlogMe {
  /** 1 like, -1 dislike, 0 none. */
  reaction: number
  rating: number | null
  /** My comments that are not public yet («در انتظار تأیید»). */
  pendingComments: BlogComment[]
}

export const blogKeys = {
  all: ['blog'] as const,
  comments: (postId: string) => [...blogKeys.all, 'comments', postId] as const,
  me: (postId: string) => [...blogKeys.all, 'me', postId] as const,
}

/** Approved comments — public, no session needed. */
export function useBlogComments(postId: string) {
  return useQuery({
    queryKey: blogKeys.comments(postId),
    queryFn: async () => {
      const { data } = await apiClient.get<{ comments: BlogComment[] }>(
        `/blog/posts/${postId}/comments`,
      )
      return asList<BlogComment>(data?.comments)
    },
    staleTime: 60_000,
  })
}

/**
 * My like, stars and pending comments. `enabled` is the caller's «signed in»
 * — a signed-out reader has no «me» to ask about, and the page says so rather
 * than showing an empty state that looks like «nothing yet».
 */
export function useBlogMe(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: blogKeys.me(postId),
    queryFn: async () => {
      const { data } = await apiClient.get<BlogMe>(`/blog/posts/${postId}/me`)
      return {
        reaction: typeof data?.reaction === 'number' ? data.reaction : 0,
        rating: typeof data?.rating === 'number' ? data.rating : null,
        pendingComments: asList<BlogComment>(data?.pendingComments),
      }
    },
    enabled,
  })
}

export function useAddBlogComment(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { body: string; parentId?: string | null; website?: string }) => {
      const { data } = await apiClient.post<{ comment: BlogComment | null }>(
        `/blog/posts/${postId}/comments`,
        input,
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: blogKeys.me(postId) })
    },
  })
}

export function useSetBlogReaction(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (value: 1 | -1 | 0) => {
      const { data } = await apiClient.put<{ value: number; stats: BlogPublicStats }>(
        `/blog/posts/${postId}/reaction`,
        { value },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: blogKeys.me(postId) })
    },
  })
}

export function useSetBlogRating(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (stars: number) => {
      const { data } = await apiClient.put<{ stars: number; stats: BlogPublicStats }>(
        `/blog/posts/${postId}/rating`,
        { stars },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: blogKeys.me(postId) })
    },
  })
}

/**
 * One view. Fire-and-forget: a reader must never see a failure here, and a
 * failed beacon is not worth a retry storm — the count is a statistic.
 */
export function recordBlogView(postId: string): void {
  apiClient.post(`/blog/posts/${postId}/view`).catch(() => undefined)
}
