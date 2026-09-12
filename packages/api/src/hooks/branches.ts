// ============================================
// packages/api/src/hooks/branches.ts
//
// Branches, from the client side.
//
// WHY THIS FILE EXISTS (G2)
//
// `/api/branches` has existed since the branch migration — list, create,
// update, assign members — and no client hook ever called it. So the People
// screen had no way to show a branch, the employee form had no way to offer
// one, and `branches` was a table the product could not reach.
//
// Same shape of gap as `/api/payments` in Phase B: the address was there,
// nothing pointed at it.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { asList } from '../lib/as-list'
import { apiClient } from '../lib/client'
import { useAuthReady } from './useAuthReady'

export interface Branch {
  id: string
  workspaceId: string
  code: string
  name: string
  parentBranchId: string | null
  isActive: boolean
  /** The employee who runs it. null means nobody is named yet, which is normal. */
  managerEmployeeId: string | null
}

/** One person posted to a branch. */
export interface BranchEmployee {
  id: string
  employeeCode: string | null
  firstName: string
  lastName: string
  position: string | null
  /** false means a temporary posting alongside their home branch. */
  isPrimary: boolean
}

export interface BranchTreeNode extends Branch {
  managerName: string | null
  /** People whose PRIMARY posting is this branch — not counted twice for visitors. */
  headCount: number
  employees: BranchEmployee[]
  children: BranchTreeNode[]
}

export interface CreateBranchInput {
  code: string
  name: string
  parentBranchId?: string | undefined
  managerEmployeeId?: string | null | undefined
}

export const branchKeys = {
  all: ['branches'] as const,
  list: () => [...branchKeys.all, 'list'] as const,
  tree: () => [...branchKeys.all, 'tree'] as const,
}

const unwrap = <T>(response: unknown): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data
  }
  return response as T
}

/** The flat list — what the employee form's branch picker needs. */
export function useBranches() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: branchKeys.list(),
    queryFn: async () => {
      const body = unwrap<{ branches: Branch[] }>(await apiClient.get('/branches'))
      return asList<Branch>(body?.branches, '/branches')
    },
    enabled: authReady,
    // Branches change rarely — a shop adds one every few months — so this is
    // cached longer than a list of invoices would be.
    staleTime: 1000 * 60 * 5,
  })
}

/** The nested tree with each branch's people — the «شعب» tab. */
export function useBranchTree() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: branchKeys.tree(),
    queryFn: async () => {
      const body = unwrap<{ tree: BranchTreeNode[] }>(await apiClient.get('/branches/tree'))
      return asList<BranchTreeNode>(body?.tree, '/branches/tree')
    },
    enabled: authReady,
    staleTime: 1000 * 60,
  })
}

export function useCreateBranch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateBranchInput) =>
      unwrap<Branch>(await apiClient.post('/branches', input)),

    onSuccess: () => {
      // Both, and not just the list: the tree carries head counts and manager
      // names that a new branch changes, and a tab showing a stale tree after
      // the user just added a branch reads as "it did not save".
      queryClient.invalidateQueries({ queryKey: branchKeys.all })
    },
  })
}
