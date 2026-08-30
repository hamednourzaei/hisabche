// ============================================
// backend/src/services/mdm/index.ts
//
// The Master Data Management core's public surface.
//
// It finds and PROPOSES duplicates. It never merges on its own — a merge moves
// invoices, debts and payment history between identities, and undoing a wrong
// one is far more expensive than leaving a duplicate in place for another day.
// ============================================

export { MdmService } from './mdm.service'

export {
  editDistance,
  findDuplicates,
  goldenRecord,
  nameSimilarity,
  normaliseDigits,
  normaliseIdentifier,
  normaliseName,
  normalisePhone,
  pickSurvivor,
  scorePair,
  validateMerge,
  type DuplicateCandidate,
  type MatchReason,
  type MdmEntity,
  type MdmRecord,
  type MergeRuleCode,
} from './mdm.domain'

import { MdmService } from './mdm.service'

export const mdm = new MdmService()
