'use client'

// The sign-in end of every PUBLIC header (landing TopNav, blog header).
//
// Signed out (and in the prerendered HTML): «ورود» + «شروع رایگان».
// Signed in, decided after mount: one «داشبورد» link, `rel="nofollow"` —
// a public page linking into the private app (CLAUDE.md §8).
//
// It is the one client island these headers need; everything around it can
// stay a server component.
import Link from 'next/link'

import { useSignedInAfterMount } from '../../../hooks/use-signed-in-after-mount'

export interface PublicAuthActionsProps {
  /** `/fa`, `/af`, `/en` — or '' on a host with no locale segment. */
  routePrefix: string
  labels: { signIn: string; signUp: string; dashboard: string }
  /** Arrow after «start free», pointing the reading direction. */
  isRTL: boolean
  onNavigateCta?: (() => void) | undefined
}

const PRIMARY =
  'inline-flex min-h-9 items-center gap-1 rounded-full px-4 text-sm font-bold text-[hsl(var(--color-primary-fg))] bg-[image:var(--gradient-brand)] hover:brightness-110 transition-all motion-reduce:transition-none shrink-0 lg:min-h-10 lg:px-5'

export function PublicAuthActions({
  routePrefix,
  labels,
  isRTL,
  onNavigateCta,
}: PublicAuthActionsProps) {
  const signedIn = useSignedInAfterMount()

  if (signedIn) {
    return (
      <Link
        prefetch={false}
        href={`${routePrefix}/dashboard`}
        rel="nofollow"
        data-testid="landing-dashboard-link"
        className={PRIMARY}
      >
        {labels.dashboard}
      </Link>
    )
  }

  return (
    <>
      <Link
        prefetch={false}
        href={`${routePrefix}/login`}
        className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-[hsl(var(--fg-secondary))] transition-colors motion-reduce:transition-none hover:text-[hsl(var(--fg-primary))] md:inline-flex"
      >
        {labels.signIn}
      </Link>
      <Link
        prefetch={false}
        href={`${routePrefix}/signup`}
        // Spread rather than pass `undefined`: `exactOptionalPropertyTypes`
        // makes `onClick={undefined}` a type error on LinkProps.
        {...(onNavigateCta ? { onClick: onNavigateCta } : {})}
        className={PRIMARY}
      >
        <span className="cta-text">{labels.signUp}</span>
        <span aria-hidden="true" className="hidden lg:inline">
          {isRTL ? '←' : '→'}
        </span>
      </Link>
    </>
  )
}
