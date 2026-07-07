import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabaseClient } from '@hisabche/auth'

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

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

const ROLE_RANK: Record<string, number> = { owner: 4, admin: 3, member: 2, viewer: 1 }

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaceId: null,
      workspaceName: '',
      members: [],
      invites: [],
      currentUserRole: 'member',
      loading: false,

      setWorkspace: (id, name) => set({ workspaceId: id, workspaceName: name }),

      fetchWorkspace: async (userId: string) => {
        set({ loading: true })
        try {
          const token = (await supabaseClient.auth.getSession()).data.session?.access_token
          if (!token) return

          const base = 'https://hisabche.onrender.com/api'
          const [wsRes, memRes] = await Promise.all([
            fetch(`${base}/workspaces`, { headers: { Authorization: `Bearer ${token}` } }),
            (async () => {
              const r = await fetch(`${base}/workspaces`, { headers: { Authorization: `Bearer ${token}` } });
              if (!r.ok) return null;
              const wss = await r.json();
              const ws = wss?.[0];
              if (!ws) return null;
              const mr = await fetch(`${base}/workspaces/${ws.id}/members`, { headers: { Authorization: `Bearer ${token}` } });
              if (!mr.ok) return null;
              return { ws, members: await mr.json() };
            })(),
          ]);

          if (!wsRes.ok) return;
          const workspaces = await wsRes.json();
          const ws = workspaces?.[0];
          const members = memRes?.members;

          // Find current user's role — but only if members loaded
          const me = members?.find((m: any) => m.user_id === userId);

          // ✅ Only set if we actually got data
          if (ws && members && me) {
            set({
              workspaceId: ws.id,
              workspaceName: ws.name || '',
              currentUserRole: me.role || 'member',
              members: members.map((m: any) => ({
                id: m.id,
                userId: m.user_id,
                fullName: m.user?.full_name || m.user?.email || 'Unknown',
                email: m.user?.email || '',
                role: m.role,
                joinedAt: new Date(m.joined_at || m.created_at).getTime(),
                isActive: true,
              })),
              loading: false,
            });
          } else {
            set({ loading: false });
          }
        } catch (err) {
          console.error('[Workspace] fetchWorkspace error:', err);
          set({ loading: false });
        }
      },

      addMember: (member) =>
        set((s) => ({ members: [...s.members.filter((m) => m.userId !== member.userId), member] })),

      removeMember: (userId) =>
        set((s) => ({ members: s.members.filter((m) => m.userId !== userId) })),

      updateMemberRole: (userId, role) =>
        set((s) => ({ members: s.members.map((m) => (m.userId === userId ? { ...m, role } : m)) })),

      addInvite: (invite) =>
        set((s) => ({ invites: [invite, ...s.invites].slice(0, 50) })),

      acceptInvite: (inviteId) =>
        set((s) => ({ invites: s.invites.map((i) => (i.id === inviteId ? { ...i, status: 'accepted' as const } : i)) })),

      setCurrentUserRole: (role) => set({ currentUserRole: role }),

      canEdit: () => (ROLE_RANK[get().currentUserRole] ?? 0) >= (ROLE_RANK['admin'] ?? 0),
      canDelete: () => get().currentUserRole === 'owner',
      canInvite: () => (ROLE_RANK[get().currentUserRole] ?? 0) >= (ROLE_RANK['admin'] ?? 0),
    }),
    {
      name: 'hisabche-workspace',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') return localStorage
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