export { primaryDb, supabase } from './primary'
export { replicaDb, getReplicaClientOrPrimary } from './replica'
export { adminDb } from './admin'
export {
  REPLICA_READ_ALLOWLIST,
  isReplicaAllowedCaller,
  selectReadClient,
  DEFAULT_MAX_REPLICA_LAG_MS,
} from './routing'
