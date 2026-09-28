// ============================================
// packages/ui/src/lib/enter-workspace.ts
//
// Make another workspace the active one — used to step into a sandbox and
// back out of it.
//
// The app has no in-place workspace switcher: every cached query, the
// capabilities, the members and (on desktop) the local database are bound to
// the active workspace. A reload starts all of them over in the new one at
// once; the persisted store carries the choice across it, and fetchWorkspace
// checks it against the server's list on the way back in.
// ============================================

import { useWorkspaceStore } from '@hisabche/store'

export function enterWorkspace(id: string, name: string): void {
  useWorkspaceStore.getState().setWorkspace(id, name)
  window.location.reload()
}
