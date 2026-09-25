// ============================================
// The Supabase client, with the signed-in person's token wired into it.
//
// Every realtime user in this package imports the client from HERE, so none
// of them can open a channel on a client that is still anonymous — see the
// note in packages/auth/src/supabase.ts for why anonymous meant "hears
// nothing". Kept apart from lib/tokenProvider so that module stays free of
// supabase-js, which the realtime code loads lazily.
// ============================================

import { setSupabaseTokenSource, supabaseClient } from '../../../auth/src/supabase'
import { getToken } from '../lib/tokenProvider'

const signedOutListeners = new Set<() => void>()

/**
 * Called when realtime asks for a token and there is none — i.e. the session
 * has ended. supabase-js asks on every heartbeat, so this is the one place
 * that reliably notices a sign-out for this client, which never holds a
 * session of its own (and whose `auth` throws once `accessToken` is set).
 */
export function onSignedOut(listener: () => void): void {
  signedOutListeners.add(listener)
}

setSupabaseTokenSource(() => {
  const token = getToken()
  if (!token) for (const listener of signedOutListeners) listener()
  return token
})

export { supabaseClient }
