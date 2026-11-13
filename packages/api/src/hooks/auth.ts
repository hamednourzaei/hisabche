// ============================================
// Auth Hooks — TanStack Query
// ============================================

import { useMutation, useQuery } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { removeStorage, writeStorage, STORAGE_KEYS } from '../storage'
import type { LoginInput, SignUpInput } from '@hisabche/validation'

interface AuthResponse {
  data: {
    user: {
      id: string
      email: string
      fullName: string
      businessName?: string
      createdAt: string
    }
    token: string
  }
}

export function useLogin() {
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const response = await apiClient.post<AuthResponse['data']>('/auth/login', input)
      const data = response.data
      writeStorage(STORAGE_KEYS.token, data.token)
      return data
    },
  })
}

export function useSignUp() {
  return useMutation({
    mutationFn: async (input: SignUpInput) => {
      const response = await apiClient.post<AuthResponse['data']>('/auth/signup', input)
      const data = response.data
      writeStorage(STORAGE_KEYS.token, data.token)
      return data
    },
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout')
      removeStorage(STORAGE_KEYS.token)
    },
  })
}

// ✅ گیت شده با authReady تا قبل از hydrate شدن session، بدون توکن fire نشود
export function useCurrentUser() {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await apiClient.get<{ user: AuthResponse['data']['user'] }>('/auth/me')
      return response.data.user
    },
    enabled: authReady,
    staleTime: 1000 * 60 * 10,
    retry: false,
  })
}
