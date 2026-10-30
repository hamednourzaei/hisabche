// ============================================
// The offline session — built in ONE place.
//
// ⚠️ IT WAS BUILT IN TWO.
//
// `login-page.tsx` and `auth.store.ts` each assembled their own session
// object: the same token, the same fallback ids, the same hard-coded
// Persian display name. Two copies of one session means the two answers can
// differ — the restart path and the first-run path produced different
// sessions for the same business — and the name was Persian in an English
// app.
//
// The display name is now an i18n key (`auth.localUser`). It is resolved
// HERE, from the catalog, rather than being written into the code: a store
// is not a component, but it still has to be able to say what the local
// owner is called.
//
// The rest of the shell reads the session from the store; nothing else may
// build one.
// ============================================

import {
  formatMessage,
  getMessages,
  resolveMessage,
  toMessageLocale,
} from '@hisabche/i18n/messages'
import type { Session } from '@hisabche/auth-core'

import { i18n } from '@/shared/i18n'

/** The token a local session carries. The engine never checks it. */
export const OFFLINE_SESSION_TOKEN = 'local-offline-session-token'

/** The local owner's address. There is no mail server on a device. */
export const OFFLINE_SESSION_EMAIL = 'local@hisabche.local'

/**
 * The owner id used when the engine has not written one yet.
 *
 * The engine's own default (`22222222-…`) is what a fresh device has; this
 * one is the last resort so a session always has an id.
 */
export const OFFLINE_FALLBACK_OWNER_ID = '00000000-0000-0000-0000-000000000001'

/** What the shell needs to know about the local workspace. */
export interface OfflineWorkspace {
  id: string
  name: string
  ownerId?: string | undefined
  ownerName?: string | undefined
  ownerEmail?: string | undefined
  createdAt?: string | undefined
  /**
   * The trades stored on THIS device. The first run and every restart build
   * the session from this field, so a fresh offline install resolves the same
   * profile as an online one without waiting for a sync.
   */
  businessTypes?: string[] | undefined
}

/**
 * The name the local owner is shown under.
 *
 * ⚠️ NOT A STRING IN THE CODE. An English install used to show Persian.
 */
export function localUserDisplayName(): string {
  const catalog = getMessages(toMessageLocale(i18n.language))
  return resolveMessage(catalog, 'auth.localUser') ?? ''
}

/** The one function that builds an offline session. */
export function buildOfflineSession(workspace: OfflineWorkspace): Session {
  const cleanEmail =
    workspace.ownerEmail && !workspace.ownerEmail.endsWith('.local')
      ? workspace.ownerEmail
      : OFFLINE_SESSION_EMAIL

  const fullName = workspace.ownerName?.trim() || localUserDisplayName()

  return {
    user: {
      id: workspace.ownerId || OFFLINE_FALLBACK_OWNER_ID,
      email: cleanEmail,
      fullName,
      businessName: workspace.name,
      role: 'owner',
      createdAt: workspace.createdAt || new Date().toISOString(),
      ...(workspace.businessTypes ? { businessTypes: workspace.businessTypes } : {}),
    },
    token: OFFLINE_SESSION_TOKEN,
  }
}
