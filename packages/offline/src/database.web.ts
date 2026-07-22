// packages/offline/src/database.web.ts
// ============================================
// Web-only — IndexedDB via Dexie
// ============================================

import Dexie, { Table } from 'dexie';
import type { Activity } from '@hisabche/db-schema';

class OfflineDatabase extends Dexie {
  activities!: Table<Activity>;

  constructor() {
    super('HisabcheOffline');
    this.version(1).stores({
      activities: 'id, entityType, entityId, action, createdAt, isRead',
    });
  }
}

export const db = new OfflineDatabase();

export async function performSync() {
  // TODO: Sync logic with server
  return { success: true };
}