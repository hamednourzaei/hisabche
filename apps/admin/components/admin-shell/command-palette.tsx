'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DialogTitle,
  useLocalePush,
} from '@/components/ui'
import { ADMIN_NAV } from './admin-nav'

/**
 * Quick navigation over the 8 hubs.
 *
 * The item list is derived from `ADMIN_NAV` — the same model the sidebar and
 * the header read — so a path or a default tab can never be changed in one
 * place and left behind in another. Navigation goes through `useLocalePush`,
 * because a bare `/dashboard` was rewritten by `proxy.ts` to the default
 * language and silently switched an English console to Persian.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations()
  const push = useLocalePush()

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  const runCommand = (route: string) => {
    onOpenChange(false)
    push(route)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">{t('admin.command.label')}</DialogTitle>
      <CommandInput
        aria-label={t('admin.command.label')}
        placeholder={t('admin.command.placeholder')}
      />
      <CommandList>
        <CommandEmpty>{t('admin.command.empty')}</CommandEmpty>

        <CommandGroup heading={t('admin.command.hubs')}>
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.id}
                value={`${t(item.titleKey)} ${item.path}`}
                onSelect={() => runCommand(`${item.path}?tab=${item.defaultTab}`)}
              >
                <Icon className="me-2 h-4 w-4 shrink-0" aria-hidden="true" />
                {t(item.titleKey)}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
