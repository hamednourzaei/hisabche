import React, { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuthStore } from './auth.store'

/** Route guard. The session is hydrated before render, so this is sync. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
