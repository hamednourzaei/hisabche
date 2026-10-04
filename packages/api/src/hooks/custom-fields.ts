// ============================================
// A business's own fields on a customer, supplier or product (#141–#143).
//
//   GET   /custom-fields/:entity/:entityId/values
//   PUT   /custom-fields/:entity/:entityId/values     { values }
//   POST  /custom-fields/:entity                      (manager and up)
//   PATCH /custom-fields/definitions/:id/active       (manager and up)
//
// A formula field has no stored value: `computed[key]` is its value, or the
// reason it cannot be computed for this record — never zero.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export type CustomFieldEntity = 'customer' | 'supplier' | 'product'
export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean' | 'choice' | 'formula'
export type CustomFieldValue = string | number | boolean | null

export interface CustomField {
  id: string
  key: string
  label: string
  type: CustomFieldType
  choices: string[] | null
  formula: string | null
  required: boolean
  isActive: boolean
}

export interface CustomFieldRecord {
  fields: CustomField[]
  values: Record<string, CustomFieldValue>
  computed: Record<string, { ok: true; value: number } | { ok: false; code: string }>
}

export interface CustomFieldInput {
  key: string
  label: string
  type: CustomFieldType
  choices: string[] | null
  formula: string | null
  required: boolean
}

export const customFieldKeys = {
  all: ['custom-fields'] as const,
  entity: (entity: CustomFieldEntity) => [...customFieldKeys.all, entity] as const,
  record: (entity: CustomFieldEntity, entityId: string) =>
    [...customFieldKeys.entity(entity), entityId] as const,
}

const normalise = (data: CustomFieldRecord): CustomFieldRecord => ({
  fields: asList<CustomField>(data?.fields),
  values: data?.values && typeof data.values === 'object' ? data.values : {},
  computed: data?.computed && typeof data.computed === 'object' ? data.computed : {},
})

export function useCustomFieldRecord(
  entity: CustomFieldEntity,
  entityId: string,
  requested = true,
) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: customFieldKeys.record(entity, entityId),
    queryFn: async () =>
      normalise(
        (await apiClient.get<CustomFieldRecord>(`/custom-fields/${entity}/${entityId}/values`))
          .data,
      ),
    enabled: ready && requested && !!entityId,
    staleTime: 30_000,
  })
}

export function useSaveCustomFieldValues(entity: CustomFieldEntity, entityId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: Record<string, CustomFieldValue>) =>
      normalise(
        (
          await apiClient.put<CustomFieldRecord>(`/custom-fields/${entity}/${entityId}/values`, {
            values,
          })
        ).data,
      ),
    onSuccess: (record) =>
      queryClient.setQueryData(customFieldKeys.record(entity, entityId), record),
  })
}

export function useDefineCustomField(entity: CustomFieldEntity) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CustomFieldInput) =>
      (await apiClient.post<CustomField>(`/custom-fields/${entity}`, input)).data,
    // Every record of this entity now has one more field.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customFieldKeys.entity(entity) }),
  })
}

export function useSetCustomFieldActive(entity: CustomFieldEntity) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) =>
      (
        await apiClient.patch<CustomField>(`/custom-fields/definitions/${input.id}/active`, {
          isActive: input.isActive,
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customFieldKeys.entity(entity) }),
  })
}
