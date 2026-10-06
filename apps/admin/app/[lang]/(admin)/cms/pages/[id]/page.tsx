export const dynamic = 'force-dynamic'
export const revalidate = 0

import { CmsPageEditorClient } from '@/components/cms/cms-page-editor-client'

export default function EditCmsPage({ params }: { params: { id: string } }) {
  return <CmsPageEditorClient isNew={false} pageId={params.id} />
}
