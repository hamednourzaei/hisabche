// Shim: maps the next/navigation API surface onto react-router.
import {
  useLocation,
  useNavigate,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
} from 'react-router-dom'

/**
 * Next accepts a second options argument (`{ scroll }`). Shared screens pass it
 * — accounting's tab switch does — so the shim must too, even though desktop
 * has nothing to scroll: the app shell owns its own scroll containers.
 */
export interface NavigateOptions {
  scroll?: boolean
}

export interface AppRouter {
  push(href: string, options?: NavigateOptions): void
  replace(href: string, options?: NavigateOptions): void
  back(): void
  forward(): void
  refresh(): void
  prefetch(): void
}

export function useRouter(): AppRouter {
  const navigate = useNavigate()

  return {
    push: (href) => navigate(href),
    replace: (href) => navigate(href, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    // Desktop data lives in TanStack Query; a route-level refresh is a no-op.
    refresh: () => undefined,
    prefetch: () => undefined,
  }
}

export function usePathname(): string {
  return useLocation().pathname
}

export function useSearchParams(): URLSearchParams {
  const [params] = useRouterSearchParams()
  return params
}

export function useParams<T extends Record<string, string | undefined>>(): T {
  return useRouterParams() as T
}

export function redirect(href: string): never {
  window.location.hash = href
  throw new Error('REDIRECT')
}

export function notFound(): never {
  throw new Error('NOT_FOUND')
}
