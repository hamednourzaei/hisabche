'use client'

import { useEffect, useState } from 'react'
import { createAdminSupabaseClient } from '@/lib/supabase-client'

export function useAdminSession() {
  const [session, setSession] = useState<{ userId: string; email: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createAdminSupabaseClient()
    const fetchSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          setError('NO_SESSION')
        } else {
          const user = data.session.user
          setSession({ userId: user.id, email: user.email ?? null })
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'SESSION_ERROR')
      } finally {
        setLoading(false)
      }
    }
    fetchSession()
  }, [])

  return { session, loading, error }
}
