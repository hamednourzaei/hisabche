// Customer Profile Core — public surface. Routes and other cores import from here only.

export { CustomerProfileService } from './customer-profile.service'
export type { CustomerAccounting, CustomerProfile, TermsInput } from './customer-profile.service'
export {
  ALLOWED_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  CustomerProfileError,
  cleanFileName,
  combinedBalance,
  creditControl,
  customerInsights,
  matchDocumentEntries,
  isMissingSchema,
  validateDocument,
} from './customer-profile.domain'
export type {
  CreditControl,
  CustomerDocument,
  DocumentAccounting,
  Insight,
  InsightCode,
} from './customer-profile.domain'
