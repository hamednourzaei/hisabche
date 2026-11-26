import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_BUILD_ID ??
    process.env.VERCEL_DEPLOYMENT_ID ??
    'dev-local'

  return NextResponse.json(
    {
      buildId,
      appVersion: '1.0.0',
      minSupportedApiVersion: '1.0.0',
      serverTimeMs: Date.now(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'x-hisabche-web-build': buildId,
      },
    },
  )
}
