// packages/offline/src/sync/sync-queue.ts
export class SyncQueue {
  private queue: Array<{ id: string; action: string; data: unknown }> = [];

  add(item: { id: string; action: string; data: unknown }) {
    this.queue.push(item);
  }

  async process() {
    // TODO: Process sync queue
    return { processed: this.queue.length };
  }

  clear() {
    this.queue = [];
  }

  get length() {
    return this.queue.length;
  }
}

export const syncQueue = new SyncQueue();