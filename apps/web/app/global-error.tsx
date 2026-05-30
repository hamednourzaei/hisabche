"use client"

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-[#060d1f] p-6">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="size-10 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">خطای سیستمی</h1>
            <p className="text-sm text-gray-400 mb-6">اطلاعات شما امن است. لطفاً دوباره تلاش کنید.</p>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-medium transition-colors"
            >
              <RefreshCw className="size-4" />
              تلاش دوباره
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}