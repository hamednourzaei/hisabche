// ============================================
// backend/src/services/blog — the Blog Core's only public surface.
// ============================================

export { BlogService, MIN_POSTS_FOR_INDEXED_TAG } from './blog.service'
export type {
  AdminPost,
  AdminPostSummary,
  BlogComment,
  BlogPostPublic,
  BlogPostSummary,
  BlogTaxonomyRef,
  PublicStats,
  SaveResult,
} from './blog.service'
export { BlogError, type BlogErrorCode } from './blog.domain'
