"use client";

import { useState, useEffect, useCallback } from "react";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CommandPalette v3 — i18n-ready
   ═══════════════════════════════════════════════════════════════════════════ */

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon?: string;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  commands: CommandItem[];
  shortcutKey?: string;
}

export function CommandPalette({ commands, shortcutKey = "." }: CommandPaletteProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const handleOpen = useCallback(() => { setOpen(true); setSearch(""); }, []);
  const handleClose = useCallback(() => { setOpen(false); setSearch(""); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === shortcutKey && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); open ? handleClose() : handleOpen(); }
      if (e.key === "Escape" && open) { e.preventDefault(); handleClose(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleOpen, handleClose, shortcutKey]);

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description.toLowerCase().includes(search.toLowerCase()) ||
    cmd.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Command.Dialog open={open} onOpenChange={setOpen}
      label={t("commandPalette.title")}
      className={cn("fixed start-1/2 top-[20vh] z-50 w-full max-w-lg -translate-x-1/2", "rounded-2xl", "border border-[hsl(var(--border-strong))]", "bg-[hsl(var(--surface-elevated))]", "shadow-lg", "data-[state=open]:animate-in data-[state=closed]:animate-out", "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", "data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2", "motion-reduce:animate-none")}>
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border-default))] px-4 py-3">
        <Search className="size-5 shrink-0 text-[hsl(var(--fg-tertiary))]" aria-hidden="true" />
        <Command.Input value={search} onValueChange={setSearch}
          placeholder={t("commandPalette.searchPlaceholder")}
          className={cn("w-full bg-transparent text-sm outline-none", "text-[hsl(var(--fg-primary))]", "placeholder:text-[hsl(var(--fg-tertiary))]")}
          aria-label={t("commandPalette.searchAria")} />
        <div className={cn("hidden items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] sm:inline-flex", "border border-[hsl(var(--border-default))]", "bg-[hsl(var(--surface-muted))]", "text-[hsl(var(--fg-tertiary))]")}>
          <span className="text-xs">⌘</span>{shortcutKey}
        </div>
      </div>
      <Command.List className="max-h-64 overflow-y-auto p-2">
        <Command.Empty className={cn("p-4 text-center text-sm", "text-[hsl(var(--fg-tertiary))]")}>
          {t("commandPalette.noResults")}
        </Command.Empty>
        {filteredCommands.map((item) => (
          <Command.Item key={item.id} onSelect={() => { item.onSelect(); handleClose(); }}
            className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm", "cursor-pointer transition-colors duration-100", "motion-reduce:transition-none", "min-h-[44px]", "text-[hsl(var(--fg-primary))]", "data-[selected=true]:bg-[hsl(var(--color-primary)/0.08)] data-[selected=true]:text-[hsl(var(--color-primary))]")}>
            <span className="shrink-0 text-lg">{item.icon}</span>
            <div className="min-w-0 flex-1 text-start"><p className="truncate font-medium">{item.label}</p><p className="truncate text-xs text-[hsl(var(--fg-tertiary))]">{item.description}</p></div>
            {item.shortcut && <kbd className={cn("hidden items-center rounded-md px-1.5 py-0.5 text-[10px] sm:inline-flex", "border border-[hsl(var(--border-default))]", "bg-[hsl(var(--surface-muted))]", "text-[hsl(var(--fg-tertiary))]")}>{item.shortcut}</kbd>}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}