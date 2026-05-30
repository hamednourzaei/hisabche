"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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

export function CommandPalette({ commands, shortcutKey = "." }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = commands.filter(
    (cmd) =>
      cmd.label.includes(query) ||
      cmd.description.includes(query) ||
      cmd.id.includes(query)
  )

  const handleOpen = useCallback(() => {
    setOpen(true)
    setQuery("")
    setSelectedIndex(0)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    setQuery("")
  }, [])

  const handleSelect = useCallback(
    (item: CommandItem) => {
      item.onSelect()
      handleClose()
    },
    [handleClose]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === shortcutKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.stopPropagation()
        if (open) {
          handleClose()
        } else {
          handleOpen()
        }
      }
      if (e.key === "Escape" && open) {
        e.preventDefault()
        handleClose()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, handleOpen, handleClose, shortcutKey])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
      }
      if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault()
        handleSelect(filtered[selectedIndex])
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, filtered, selectedIndex, handleSelect])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[var(--z-cmdk)] flex items-start justify-center pt-[20vh]"
      onClick={handleClose}
    >
      <div
        className="glass-strong w-full max-w-lg animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--hisab-border)] px-4 py-3">
          <Search className="size-5 text-[var(--hisab-muted-fg)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="جستجوی سریع..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--hisab-muted-fg)]"
          />
          <div className="hidden sm:inline-flex items-center gap-1 rounded-md border border-[var(--hisab-border)] bg-[var(--hisab-muted)] px-1.5 py-0.5 text-[10px] text-[var(--hisab-muted-fg)]">
            <span className="text-xs">⌘</span>{shortcutKey}
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-[var(--hisab-muted-fg)]">
              نتیجه‌ای پیدا نشد
            </p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors text-right",
                  i === selectedIndex
                    ? "bg-[var(--hisab-primary)]/10 text-[var(--hisab-primary)]"
                    : "text-[var(--hisab-foreground)] hover:bg-[var(--hisab-muted)]"
                )}
              >
                <span className="text-lg shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.label}</p>
                  <p className="text-xs text-[var(--hisab-muted-fg)] truncate">{item.description}</p>
                </div>
                {item.shortcut && (
                  <kbd className="hidden sm:inline-flex items-center rounded-md border border-[var(--hisab-border)] bg-[var(--hisab-muted)] px-1.5 py-0.5 text-[10px] text-[var(--hisab-muted-fg)]">
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}