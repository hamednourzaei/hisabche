// ============================================
// Synchronous static catalog exports for Next.js web / parity tests.
// Shell hosts (desktop / mobile) MUST use `@hisabche/i18n/messages` (`loadMessages`)
// so only the active locale is bundled and loaded per device.
// ============================================

import af from '../messages/af/common.json'
import en from '../messages/en/common.json'
import fa from '../messages/fa/common.json'
import { toMessageLocale, type MessageCatalog, type MessageLocale } from './messages'

export const messageCatalogs: Record<MessageLocale, MessageCatalog> = {
  fa: fa as MessageCatalog,
  af: af as MessageCatalog,
  en: en as MessageCatalog,
}

export function getMessages(lang: string | null | undefined): MessageCatalog {
  return messageCatalogs[toMessageLocale(lang)]
}
