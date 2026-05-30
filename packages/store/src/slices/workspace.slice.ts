import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type WorkspaceRole = 'owner' | 'admin' | 'employee'

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

  setWorkspace: (id: string, name: string) => void
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
      members: [],
      invites: [],
      currentUserRole: 'owner',

      setWorkspace: (id, name) => set({ workspaceId: id, workspaceName: name }),

      addMember: (member) =>
        set((s) => ({
          members: [...s.members.filter((m) => m.userId !== member.userId), member],
        })),

      removeMember: (userId) =>
        set((s) => ({
          members: s.members.filter((m) => m.userId !== userId),
        })),

      updateMemberRole: (userId, role) =>
        set((s) => ({
          members: s.members.map((m) => (m.userId === userId ? { ...m, role } : m)),
        })),

      addInvite: (invite) =>
        set((s) => ({
          invites: [invite, ...s.invites].slice(0, 50),
        })),

      acceptInvite: (inviteId) =>
        set((s) => ({
          invites: s.invites.map((i) => (i.id === inviteId ? { ...i, status: 'accepted' as const } : i)),
        })),

      setCurrentUserRole: (role) => set({ currentUserRole: role }),

      canEdit: () => {
        const { currentUserRole } = get()
        return currentUserRole === 'owner' || currentUserRole === 'admin'
      },

      canDelete: () => {
        const { currentUserRole } = get()
        return currentUserRole === 'owner'
      },

      canInvite: () => {
        const { currentUserRole } = get()
        return currentUserRole === 'owner' || currentUserRole === 'admin'
      },
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
        currentUserRole: state.currentUserRole,
      }),
    },
  ),
)