// packages/ui/src/components/ui/blog/blog-header.tsx
//
// The blog's header — a SERVER component. The only thing in it that depends on
// the reader is the sign-in end, and that is the PublicAuthActions island
// (decided after mount; the prerendered HTML is the signed-out header).
import Link from 'next/link'

import { PublicAuthActions } from '../navigation/public-auth-actions'

export interface BlogHeaderProps {
  locale: string
  labels: {
    brand: string
    blog: string
    docs: string
    signIn: string
    signUp: string
    dashboard: string
  }
}

export function BlogHeader({ locale, labels }: BlogHeaderProps) {
  const prefix = `/${locale}`
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] w-full border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base)/0.9)] backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:px-8">
        <Link
          href={prefix}
          prefetch={false}
          className="flex shrink-0 items-center gap-1 text-base font-bold text-[hsl(var(--fg-primary))] lg:text-lg"
        >
          <span>{labels.brand}</span>
          <span className="text-[hsl(var(--color-primary))]" aria-hidden="true">
            .
          </span>
        </Link>
        <nav aria-label={labels.blog} className="hidden flex-1 justify-center gap-1 sm:flex">
          <Link
            href={`${prefix}/blog`}
            prefetch={false}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
          >
            {labels.blog}
          </Link>
          <Link
            href={`${prefix}/docs/getting-started`}
            prefetch={false}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
          >
            {labels.docs}
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <PublicAuthActions
            routePrefix={prefix}
            isRTL={locale !== 'en'}
            labels={{ signIn: labels.signIn, signUp: labels.signUp, dashboard: labels.dashboard }}
          />
        </div>
      </div>
    </header>
  )
}
