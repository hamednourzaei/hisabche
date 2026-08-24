// ============================================
// @hisabche/sync — the client half of the local-first architecture.
//
// One protocol implementation, three platforms. Web supplies an IndexedDB
// StorageAdapter, desktop a SQLite-over-IPC one, mobile a native SQLite one;
// the outbox lifecycle, the retry policy and the cursor guarantees are this
// package's, so they cannot drift apart.
// ============================================

export { SyncEngine, backoffMs, newId } from './engine'
export { MemoryStorageAdapter } from './memory-adapter'
export { IndexedDbStorageAdapter, indexedDbAvailable } from './indexeddb-adapter'
export { discardMutation, mutateLocal, retryWithServerVersion } from './mutations'
export type { MutateOptions, MutateResult } from './mutations'
export { HttpTransport } from './http-transport'
export { installWakeSources, installCrossTabWake, announceMutation } from './wakeup'
export type { WakeTarget, WakeupOptions } from './wakeup'
export { collectGarbage, hydrateEntities, startGcScheduler, DEFAULT_RETENTION } from './gc'
export type { GcOptions, GcReport, HydrationSource, RetentionPolicy } from './gc'
export {
  Repository,
  InvoiceRepository,
  CustomerRepository,
  ProductRepository,
  PaymentRepository,
  createRepositories,
  changeBus,
} from './repository'
export type {
  Repositories,
  RepositoryContext,
  RepositoryRow,
  InvoiceRow,
  CustomerRow,
  ProductRow,
  TransactionRow,
} from './repository'
export type {
  LocalEntity,
  OutboxRecord,
  OutboxStatus,
  PushOutcome,
  StorageAdapter,
  SyncEngineOptions,
  SyncListener,
  SyncPhase,
  SyncState,
  Transport,
} from './types'
