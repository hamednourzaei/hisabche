export const dynamic = 'force-dynamic'
export const revalidate = 0

import { PostEditorClient } from '@/components/blog/post-editor-client'

export default async function AdminBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PostEditorClient id={id} />
}
