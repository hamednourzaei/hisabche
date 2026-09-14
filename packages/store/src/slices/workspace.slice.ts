// ============================================
// packages/store/src/slices/workspace.slice.ts
// ============================================
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { apiClient } from '@hisabche/api'

// ✅ نقش‌ها و رتبه‌بندی‌شان از @hisabche/auth-core می‌آیند (منبع واحد
// برای وب و موبایل) — این فایل دیگر تعریف موازی ندارد.
import { ROLE_RANK, type WorkspaceRole } from '@hisabche/auth-core'

export type { WorkspaceRole }

export interface WorkspaceMember {
  id: string
  userId: string
  fullName: string
  email: string
  role: WorkspaceRole
  joinedAt: number
  isActive: boolean
}

export interface WorkspaceInvite {
  id: string
  email: string
  role: WorkspaceRole
  invitedBy: string
  invitedAt: number
  status: 'pending' | 'accepted' | 'expired'
}

interface WorkspaceState {
  workspaceId: string | null
  workspaceName: string
  /**
   * The server has confirmed this user belongs to no workspace.
   *
   * ⚠️ Distinct from `workspaceId === null`, which is also the state before
   * the first load has finished. Sending a hundred requests during startup is
   * normal; sending them after the server has said "you have none" is the bug
   * this exists to let the UI avoid.
   *
   * `null` = not asked yet. `true` = asked, and the answer was none.
   */
  hasNoWorkspace: boolean | null
  members: WorkspaceMember[]
  invites: WorkspaceInvite[]
  currentUserRole: WorkspaceRole
  loading: boolean

  setWorkspace: (id: string, name: string) => void
  fetchWorkspace: (userId: string) => Promise<void>
  addMember: (member: WorkspaceMember) => void
  removeMember: (userId: string) => void
  updateMemberRole: (userId: string, role: WorkspaceRole) => void
  addInvite: (invite: WorkspaceInvite) => void
  acceptInvite: (inviteId: string) => void
  setCurrentUserRole: (role: WorkspaceRole) => void
  canEdit: () => boolean
  canDelete: () => boolean
  canInvite: () => boolean
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaceId: null,
      workspaceName: '',
      hasNoWorkspace: null,
      members: [],
      invites: [],
      currentUserRole: 'member',
      loading: false,

      setWorkspace: (id, name) => set({ workspaceId: id, workspaceName: name }),

      fetchWorkspace: async (userId: string) => {
        set({ loading: true })
        try {
          // ⚠️ THE SHARED CLIENT, NOT A SUPABASE BROWSER SESSION.
          //
          // This read `supabaseClient.auth.getSession()` for a token and posted to
          // a hardcoded `https://hisabche.onrender.com/api`. The app signs in
          // through its own backend and never creates a Supabase browser
          // session, so there was never a token: the function returned early
          // with `loading` still true, and «/governance?tab=members» sat on its
          // skeleton forever. The same early return kept a stale workspace id
          // alive (the long-failing workspace-staleness test). `apiClient`
          // carries the real token, the configured base URL, and renews an
          // expired session.
          let workspaces: unknown
          try {
            workspaces = (await apiClient.get('/workspaces')).data
          } catch {
            // A failed request says nothing about which workspaces exist — the
            // network is down, or the session could not be renewed. Keep what
            // is stored and try again later. Only a SUCCESSFUL empty answer is
            // evidence.
            set({ loading: false })
            return
          }

          // ⚠️ THE SERVER IS THE AUTHORITY ON WHICH WORKSPACES EXIST.
          //
          // `workspaceId` is persisted to localStorage, and nothing used to
          // check it against this answer. Every early return was
          // `set({ loading: false }); return` — which left a stale id in place
          // forever.
          //
          // After the database was reset, that is exactly what happened: the
          // workspace was gone, the id survived in the browser, and every
          // request carried a workspace the user could not possibly be a
          // member of. A hundred 403s, and the only way out was clearing site
          // data by hand.
          //
          // An empty list is a real answer. Honour it.
          if (!Array.isArray(workspaces) || workspaces.length === 0) {
            set({
              workspaceId: null,
              workspaceName: '',
              members: [],
              hasNoWorkspace: true,
              loading: false,
            })
            return
          }

          // Prefer the stored workspace if the server still lists it — the user
          // picked it, and silently moving them to a different set of books
          // would be worse than asking. Otherwise fall back to the first.
          const storedId = get().workspaceId
          const ws = workspaces.find((w: any) => w.id === storedId) ?? workspaces[0]

          let members: any[]
          try {
            const body = (await apiClient.get(`/workspaces/${ws.id}/members`)).data
            members = Array.isArray(body) ? body : []
          } catch {
            set({ loading: false })
            return
          }

          const me = members?.find((m: any) => m.user_id === userId)
          if (ws && members && me) {
            set({
              workspaceId: ws.id,
              workspaceName: ws.name || '',
              currentUserRole: me.role || 'member',
              members: members.map((m: any) => ({
                id: m.id,
                userId: m.user_id,
                fullName: m.full_name || m.user?.full_name || m.user?.email || 'Unknown',
                email: m.email || m.user?.email || '',
                role: m.role,
                joinedAt: new Date(m.joined_at || m.created_at).getTime(),
                isActive: true,
              })),
              hasNoWorkspace: false,
              loading: false,
            })
          } else {
            // The workspace exists and this user is not a member of it — the
            // other half of the same bug. Holding the id here produces exactly
            // the same storm of 403s, so it is cleared for the same reason.
            //
            // ⚠️ `hasNoWorkspace` is deliberately NOT persisted (see
            // `partialize`). It is the server's answer, and it is re-asked on
            // every load rather than remembered — a remembered "you have none"
            // would survive being invited to one.
            set({
              workspaceId: null,
              workspaceName: '',
              members: [],
              hasNoWorkspace: true,
              loading: false,
            })
          }
        } catch {
          // A thrown request is not evidence about workspaces. Keep what is
          // stored, leave `hasNoWorkspace` untouched, and try again.
          set({ loading: false })
        }
      },

      addMember: (member) =>
        set((s) => ({ members: [...s.members.filter((m) => m.userId !== member.userId), member] })),
      removeMember: (userId) =>
        set((s) => ({ members: s.members.filter((m) => m.userId !== userId) })),
      updateMemberRole: (userId, role) =>
        set((s) => ({ members: s.members.map((m) => (m.userId === userId ? { ...m, role } : m)) })),
      addInvite: (invite) => set((s) => ({ invites: [invite, ...s.invites].slice(0, 50) })),
      acceptInvite: (inviteId) =>
        set((s) => ({
          invites: s.invites.map((i) =>
            i.id === inviteId ? { ...i, status: 'accepted' as const } : i,
          ),
        })),
      setCurrentUserRole: (role) => set({ currentUserRole: role }),

      canEdit: () => (ROLE_RANK[get().currentUserRole] ?? 0) >= (ROLE_RANK['admin'] ?? 0),
      canDelete: () => get().currentUserRole === 'owner',
      canInvite: () => (ROLE_RANK[get().currentUserRole] ?? 0) >= (ROLE_RANK['admin'] ?? 0),
    }),
    {
      name: 'hisabche-workspace',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined')
          return localStorage
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      }),
      partialize: (state) => ({
        workspaceId: state.workspaceId,
        workspaceName: state.workspaceName,
        members: state.members,
      }),
    },
  ),
)
