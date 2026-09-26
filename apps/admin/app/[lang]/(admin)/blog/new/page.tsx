export const dynamic = 'force-dynamic'
export const revalidate = 0

import { PostEditorClient } from '@/components/blog/post-editor-client'

// `?locale=en&group=<translation group>` starts a translation of an article.
export default function AdminBlogNewPage() {
  return <PostEditorClient id={null} />
}
