// Shim: @hisabche/ui components import next/link; desktop routes with react-router.
import React, { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'

export interface NextLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  children?: ReactNode
  prefetch?: boolean
  replace?: boolean
}

const Link = forwardRef<HTMLAnchorElement, NextLinkProps>(function Link(
  { href, prefetch: _prefetch, replace, children, ...rest },
  ref,
) {
  const external = /^https?:/.test(href)
  if (external) {
    return (
      <a ref={ref} href={href} rel="noreferrer noopener" target="_blank" {...rest}>
        {children}
      </a>
    )
  }

  return (
    <RouterLink ref={ref} to={href} replace={replace ?? false} {...rest}>
      {children}
    </RouterLink>
  )
})

export default Link
