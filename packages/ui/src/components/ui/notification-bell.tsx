"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabaseClient } from "@hisabche/auth";

interface Notification {
  id: string; title: string; body?: string | null;
  type: "info" | "success" | "warning" | "approval_required";
  action_url?: string | null; entity_type?: string | null; entity_id?: string | null;
  is_read: boolean; created_at: string;
}
interface NotificationGroup { key: string; entityLabel: string; entityUrl: string; items: Notification[]; hasUnread: boolean; }
interface NotificationBellProps { className?: string; }

function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "همین الان"; if (m < 60) return `${m} دقیقه پیش`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} ساعت پیش`;
  return `${Math.floor(h / 24)} روز پیش`;
}
function resolveEntityUrl(n: Notification): string {
  if (n.action_url) return n.action_url;
  if (n.entity_type === "invoice" && n.entity_id) return `/invoices/${n.entity_id}`;
  return "/dashboard";
}
function groupNotifications(list: Notification[]): NotificationGroup[] {
  const m = new Map<string, Notification[]>();
  for (const n of list) { const k = n.entity_type && n.entity_id ? `${n.entity_type}:${n.entity_id}` : n.id; if (!m.has(k)) m.set(k, []); m.get(k)!.push(n); }
  return Array.from(m.entries()).map(([key, items]) => ({ key, entityLabel: items[0]!.title, entityUrl: resolveEntityUrl(items[0]!), items, hasUnread: items.some(i => !i.is_read) }));
}
const typeStyles: Record<string, string> = {
  info: "border-s-[hsl(var(--color-info))]", success: "border-s-[hsl(var(--color-success))]",
  warning: "border-s-[hsl(var(--color-warning))]", approval_required: "border-s-[hsl(var(--color-primary))]",
};

/* ═══════════════════════════════════════════════════════════════
   HOOK — Polling only (no WebSocket Realtime)
   ═══════════════════════════════════════════════════════════════ */
function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isMounted = useRef(true);

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabaseClient.from("notifications").select("*").order("created_at", { ascending: false }).limit(10);
    if (isMounted.current && data) setNotifications(data as Notification[]);
    const { count } = await supabaseClient.from("notifications").select("*", { count: "exact", head: true }).eq("is_read", false);
    if (isMounted.current) setUnreadCount(count ?? 0);
  }, []);

  const markAsRead = useCallback(async (ids: string[]) => {
    await supabaseClient.from("notifications").update({ is_read: true }).in("id", ids);
    setNotifications(p => p.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n));
    setUnreadCount(c => Math.max(0, c - ids.length));
  }, []);

  useEffect(() => {
    isMounted.current = true; fetchNotifications();
    const iv = setInterval(fetchNotifications, 15_000);
    return () => { isMounted.current = false; clearInterval(iv); };
  }, [fetchNotifications]);

  return { notifications, unreadCount, markAsRead };
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function NotificationBell({ className }: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const groups = useMemo(() => groupNotifications(notifications), [notifications]);
  const [tog, setTog] = useState<Record<string, boolean>>({});
  const isOpen = useCallback((g: NotificationGroup) => tog[g.key] ?? g.hasUnread, [tog]);
  const toggle = useCallback((g: NotificationGroup) => setTog(p => ({ ...p, [g.key]: !isOpen(g) })), [isOpen]);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (!panelRef.current?.contains(e.target as Node)) close(); };
    const t = setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", h); }; }, [open, close]);
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [open, close]);

  const click = useCallback((n: Notification) => { if (!n.is_read) markAsRead([n.id]); setOpen(false); router.push(resolveEntityUrl(n)); }, [markAsRead, router]);

  return (
    <div className={cn("relative", className)}>
      <button type="button" onClick={() => setOpen(!open)} className="relative p-2 rounded-xl text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150" aria-label="اعلان‌ها">
        <Bell className="size-5" />
        {unreadCount > 0 && <span className="absolute -top-1 -end-1 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[11px] font-bold text-white bg-[hsl(var(--color-destructive))] rounded-full shadow-sm shadow-[hsl(var(--color-destructive)/0.4)]">{unreadCount > 99 ? "۹۹+" : unreadCount}</span>}
      </button>
      {open && (
        <div ref={panelRef} className="absolute end-0 top-full mt-2 z-50 w-80 max-h-96 overflow-y-auto rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-lg p-2 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between px-3 py-2 mb-1 border-b border-[hsl(var(--border-default))]"><h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">اعلان‌ها</h3><button type="button" onClick={close} className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors" aria-label="بستن"><X className="size-4" /></button></div>
          {groups.length === 0 ? <p className="px-3 py-8 text-center text-sm text-[hsl(var(--fg-tertiary))]">اعلانی وجود ندارد</p> : <div className="space-y-1 mt-1">{groups.map(g => <GroupCard key={g.key} group={g} isOpen={isOpen(g)} onToggle={() => toggle(g)} onItemClick={click} />)}</div>}
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, isOpen, onToggle, onItemClick }: { group: NotificationGroup; isOpen: boolean; onToggle: () => void; onItemClick: (n: Notification) => void }) {
  return (
    <div className="rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors duration-100"><span className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--fg-secondary))]">{group.hasUnread && <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--color-destructive))] shrink-0" />}{group.entityLabel}</span><ChevronDown className={cn("size-3.5 text-[hsl(var(--fg-tertiary))] transition-transform duration-200", isOpen && "rotate-180")} /></button>
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}><div className="overflow-hidden"><div className="space-y-0.5 pt-0.5">{group.items.map(n => <button key={n.id} onClick={() => onItemClick(n)} className={cn("w-full text-start px-3 py-2 rounded-lg border-s-2 hover:bg-[hsl(var(--surface-muted))] transition-colors duration-100", n.is_read ? "border-s-transparent opacity-60" : typeStyles[n.type] ?? typeStyles.info)}><p className="text-sm font-medium text-[hsl(var(--fg-primary))] line-clamp-1">{n.title}</p>{n.body && <p className="text-xs text-[hsl(var(--fg-secondary))] mt-0.5 line-clamp-2">{n.body}</p>}<p className="text-xs text-[hsl(var(--fg-tertiary))] mt-1">{timeAgo(n.created_at)}</p></button>)}</div></div></div>
    </div>
  );
}