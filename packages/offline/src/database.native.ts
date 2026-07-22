// packages/offline/src/database.native.ts
// ============================================
// Mobile-only — WatermelonDB
// ============================================

import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { watermelonSchema } from '@hisabche/db-schema';
import ActivityModel from './models/Activity.model';

const adapter = new SQLiteAdapter({
  schema: watermelonSchema,
  jsi: true,
  onSetUpError: (error) => {
    console.error('Database setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [ActivityModel],
});

export async function performSync() {
  // TODO: Sync logic with server
  return { success: true };
}