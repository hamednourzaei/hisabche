"use client"

import { useState, useEffect, useCallback } from "react"
import { Command } from "cmdk"
import { Search } from "lucide-react"
import { cn } from "../../lib/utils"

interface CommandItem {
  id: string
  label: string
  description: string
  icon?: string
  shortcut?: string
  onSelect: () => void
}

interface CommandPaletteProps {
  commands: CommandItem[]
  shortcutKey?: string
}

export function CommandPalette({
  commands,
  shortcutKey = ".",
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const handleOpen = useCallback(() => {
    setOpen(true)
    setSearch("")
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    setSearch("")
  }, [])

  // Global keyboard shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === shortcutKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.stopPropagation()
        open ? handleClose() : handleOpen()
      }
      if (e.key === "Escape" && open) {
        e.preventDefault()
        handleClose()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, handleOpen, handleClose, shortcutKey])

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.description.toLowerCase().includes(search.toLowerCase()) ||
      cmd.id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Palette"
      className={cn(
        "fixed left-1/2 top-[20vh] z-[var(--z-cmdk)] w-full max-w-lg -translate-x-1/2",
        "rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-background)] shadow-xl",
        "animate-in fade-in-0 zoom-in-95"
      )}
    >
      <div className="flex items-center gap-3 border-b border-[var(--hisab-border)] px-4 py-3">
        <Search
          className="size-5 shrink-0 text-[var(--hisab-muted-fg)]"
          aria-hidden
        />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="جستجوی سریع..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--hisab-muted-fg)]"
          aria-label="Search commands"
        />
        <div className="hidden items-center gap-1 rounded-md border border-[var(--hisab-border)] bg-[var(--hisab-muted)] px-1.5 py-0.5 text-[10px] text-[var(--hisab-muted-fg)] sm:inline-flex">
          <span className="text-xs">⌘</span>
          {shortcutKey}
        </div>
      </div>

      <Command.List className="max-h-64 overflow-y-auto p-2">
        <Command.Empty className="p-4 text-center text-sm text-[var(--hisab-muted-fg)]">
          نتیجه‌ای پیدا نشد
        </Command.Empty>

        {filteredCommands.map((item) => (
          <Command.Item
            key={item.id}
            onSelect={() => {
              item.onSelect()
              handleClose()
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors cursor-pointer",
              "text-[var(--hisab-foreground)] hover:bg-[var(--hisab-muted)]",
              "data-[selected=true]:bg-[var(--hisab-primary)]/10 data-[selected=true]:text-[var(--hisab-primary)]"
            )}
          >
            <span className="shrink-0 text-lg">{item.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.label}</p>
              <p className="truncate text-xs text-[var(--hisab-muted-fg)]">
                {item.description}
              </p>
            </div>
            {item.shortcut && (
              <kbd className="hidden items-center rounded-md border border-[var(--hisab-border)] bg-[var(--hisab-muted)] px-1.5 py-0.5 text-[10px] text-[var(--hisab-muted-fg)] sm:inline-flex">
                {item.shortcut}
              </kbd>
            )}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  )
}