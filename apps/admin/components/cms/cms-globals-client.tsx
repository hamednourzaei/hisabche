'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Plus } from 'lucide-react'
import { apiClient } from '@hisabche/api'

export function CmsGlobalsClient() {
  const t = useTranslations()
  const queryClient = useQueryClient()
  const [locale, setLocale] = useState('fa')
  const [editKey, setEditKey] = useState('')
  const [editValue, setEditValue] = useState('')

  const { data: globals = {} } = useQuery({
    queryKey: ['cms-globals', locale],
    queryFn: async () => {
      const res = await apiClient.get(`/api/public/cms/globals/${locale}`)
      return res.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      await apiClient.put(`/api/cms/globals/${locale}/${key}`, value)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms-globals', locale] })
      setEditKey('')
      setEditValue('')
    },
  })

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            Remote Content (Globals)
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">
            Manage Cross-Platform strings. Changes sync instantly to Web, Android, and Windows
            clients without a build.
          </p>
        </div>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          className="h-10 rounded-lg border border-[hsl(var(--border-default))] px-3 text-sm"
        >
          <option value="fa">فارسی (ایران)</option>
          <option value="af">دری (افغانستان)</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4">
          <h3 className="mb-4 text-sm font-medium">Add / Update Content</h3>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Key (e.g. dashboard.welcome)"
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
              className="h-10 flex-1 rounded-lg border border-[hsl(var(--border-default))] px-3 text-sm font-mono"
            />
            <input
              type="text"
              placeholder="Content string"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-10 flex-[2] rounded-lg border border-[hsl(var(--border-default))] px-3 text-sm"
            />
            <button
              onClick={() => saveMutation.mutate({ key: editKey, value: { text: editValue } })}
              disabled={!editKey || !editValue || saveMutation.isPending}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[hsl(var(--color-primary))] px-4 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--color-primary-hover))] disabled:opacity-50"
            >
              <Save className="me-2 size-4" />
              Save & Publish
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))]">
                  Key
                </th>
                <th className="px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))]">
                  Content
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border-default))]">
              {Object.entries(globals).length === 0 ? (
                <tr>
                  <td colSpan={2} className="p-8 text-center text-[hsl(var(--fg-tertiary))]">
                    No remote content defined for {locale}.
                  </td>
                </tr>
              ) : (
                Object.entries(globals).map(([k, v]: [string, any]) => (
                  <tr key={k} className="hover:bg-[hsl(var(--surface-muted))]">
                    <td className="px-4 py-3 font-mono text-[hsl(var(--fg-primary))]">{k}</td>
                    <td className="px-4 py-3 text-[hsl(var(--fg-secondary))]">
                      {JSON.stringify(v)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
