// ============================================
// packages/local-engine/src/router.ts
//
// Pattern-matching router for local engine requests.
// Normalizes paths, extracts route parameters (:id),
// parses query strings, and dispatches to route handlers.
// Unmatched routes throw OfflineNotAvailableError (HTTP 501).
// ============================================

import type { HttpMethod, RouteHandler } from './types'

interface RegisteredRoute {
  method: HttpMethod
  pattern: RegExp
  paramNames: string[]
  handler: RouteHandler
}

export class Router {
  private routes: RegisteredRoute[] = []

  register(method: HttpMethod, path: string, handler: RouteHandler): void {
    // Normalise leading /api if present in route definition
    const clean = path.startsWith('/api/') ? path.slice(4) : path

    const paramNames: string[] = []
    const regexPattern = clean
      .replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
        paramNames.push(paramName)
        return '([^/]+)'
      })
      .replace(/\//g, '\\/')

    const pattern = new RegExp(`^${regexPattern}$`)
    this.routes.push({ method, pattern, paramNames, handler })
  }

  get(path: string, handler: RouteHandler): void {
    this.register('GET', path, handler)
  }

  post(path: string, handler: RouteHandler): void {
    this.register('POST', path, handler)
  }

  put(path: string, handler: RouteHandler): void {
    this.register('PUT', path, handler)
  }

  patch(path: string, handler: RouteHandler): void {
    this.register('PATCH', path, handler)
  }

  delete(path: string, handler: RouteHandler): void {
    this.register('DELETE', path, handler)
  }

  find(
    method: HttpMethod,
    rawPath: string,
  ): {
    handler: RouteHandler
    params: Record<string, string>
    query: Record<string, string>
  } | null {
    // Strip query string if embedded in path
    const [pathOnly, queryString] = rawPath.split('?')
    const normalized = (pathOnly ?? '').startsWith('/api/') ? pathOnly!.slice(4) : (pathOnly ?? '')

    const query: Record<string, string> = {}
    if (queryString) {
      const searchParams = new URLSearchParams(queryString)
      searchParams.forEach((val, key) => {
        query[key] = val
      })
    }

    for (const route of this.routes) {
      if (route.method !== method) continue

      const match = route.pattern.exec(normalized)
      if (match) {
        const params: Record<string, string> = {}
        route.paramNames.forEach((name, i) => {
          const val = match[i + 1]
          if (val !== undefined) {
            params[name] = decodeURIComponent(val)
          }
        })
        return { handler: route.handler, params, query }
      }
    }

    return null
  }
}
