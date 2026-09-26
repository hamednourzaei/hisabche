// apps/web/app/api/revalidate/route.ts
//
// On-demand revalidation, called by the backend after an admin publishes,
// edits or deletes a blog post, category or tag
// (backend/src/services/blog/blog.revalidate.ts).
//
// Explicit defaults (G4): without REVALIDATE_SECRET this answers 503 and does
// nothing — the blog still refreshes on its hourly ISR revalidation.
//
// Only allow-listed tags can be expired; a caller with the secret still cannot
// empty an arbitrary cache.
import { timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'

const ALLOWED_TAGS = new Set(['blog'])

function sameSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET?.trim()
  if (!secret) return Response.json({ error: 'REVALIDATE_NOT_CONFIGURED' }, { status: 503 })

  if (!sameSecret(request.headers.get('x-revalidate-secret') ?? '', secret)) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  let tags: unknown
  try {
    tags = ((await request.json()) as { tags?: unknown }).tags
  } catch {
    return Response.json({ error: 'INVALID_BODY' }, { status: 400 })
  }
  if (
    !Array.isArray(tags) ||
    tags.length === 0 ||
    !tags.every((t) => typeof t === 'string' && ALLOWED_TAGS.has(t))
  ) {
    return Response.json({ error: 'INVALID_TAGS' }, { status: 400 })
  }

  // `expire: 0`: the next request renders fresh — a just-published article
  // must not be answered from the cached 404.
  for (const tag of tags as string[]) revalidateTag(tag, { expire: 0 })
  return Response.json({ revalidated: tags })
}
