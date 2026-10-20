'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const t = useTranslations()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t('admin.command.placeholder')} />
      <CommandList>
        <CommandEmpty>{t('admin.command.empty')}</CommandEmpty>

        <CommandGroup heading={t('admin.command.hubs')}>
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard?tab=overview'))}>
            📊 {t('admin.hubs.dashboard.title')}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/customers?tab=workspaces'))}>
            👥 {t('admin.hubs.customers.title')}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/revenue?tab=subscriptions'))}>
            💳 {t('admin.hubs.revenue.title')}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/offline?tab=licences'))}>
            💻 {t('admin.hubs.offline.title')}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/product?tab=features'))}>
            ⚙️ {t('admin.hubs.product.title')}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/operations?tab=health'))}>
            🛠️ {t('admin.hubs.operations.title')}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/content?tab=blog'))}>
            📝 {t('admin.hubs.content.title')}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/security?tab=audit'))}>
            🛡️ {t('admin.hubs.security.title')}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
