// packages/offline/src/index.ts
// ============================================
// Offline exports — Web and Mobile
// ============================================

// Web
export { db, performSync } from './database.web';

// Native (overridden in mobile)
export { database } from './database.native';

// Models
export { default as ActivityModel } from './models/Activity.model';

// Sync
export { syncQueue } from './sync/sync-queue';