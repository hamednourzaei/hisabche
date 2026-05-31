"use client"

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
} as const

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  size?: keyof typeof SIZES
  children: ReactNode
}

export function Modal({
  open,
  onClose,
  title,
  size = "md",
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    // Save current focus
    restoreRef.current =
      document.activeElement as HTMLElement | null

    // Keyboard handlers
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "Tab") {
        trapFocus(e, panelRef.current)
      }
    }

    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    // Focus first focusable element
    queueMicrotask(() =>
      panelRef.current
        ?.querySelector<HTMLElement>(FOCUSABLE)
        ?.focus()
    )

    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
      style={{
        background:
          "hsl(var(--hisab-foreground) / .4)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`glass-strong animate-fade-in-up w-full ${SIZES[size]} max-h-[90vh] space-y-4 overflow-y-auto p-6`}
      >
        <div className="flex items-center justify-between">
          <h3 id={titleId} className="text-lg font-bold">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="ghost-btn"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

function trapFocus(
  e: KeyboardEvent,
  container: HTMLElement | null
) {
  if (!container) return
  const items = [
    ...container.querySelectorAll<HTMLElement>(FOCUSABLE),
  ]
  if (items.length === 0) return
  const first = items[0]!
  const last = items[items.length - 1]!
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (
    !e.shiftKey &&
    document.activeElement === last
  ) {
    e.preventDefault()
    first.focus()
  }
}