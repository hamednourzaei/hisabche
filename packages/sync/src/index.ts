// ============================================
// @hisabche/sync — the sync WIRE shared by the server and every client.
//
//   @hisabche/sync/wire    the Hisabche Sync Binary codec and its frames
//   @hisabche/sync/stream  the wake-up stream client (WebSocket)
//
// ⚠️ ONLY THE WIRE (27 Sep 2026). This package also held a complete
// client-side sync engine — SyncEngine, repositories, IndexedDB / memory
// adapters, GC, wake sources — that nothing imported: the real engine lives in
// packages/app-shell/src/features/sync (desktop SQLite over IPC) and
// apps/mobile (native SQLite). Two engines is the parallel architecture G2
// forbids, and an unused one is dead code (§14); it was removed. Git history
// has it if it is ever wanted.
// ============================================

export * from './wire'
export * from './stream-client'
