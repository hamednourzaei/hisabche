"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
} as const

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  size?: keyof typeof SIZES
  children: React.ReactNode
}

export function Modal({
  open,
  onClose,
  title,
  size = "md",
  children,
}: ModalProps) {
  const titleId = React.useId()

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <DialogPrimitive.Content
          aria-labelledby={titleId}
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4",
            "rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-background)] p-6 shadow-lg",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            SIZES[size],
            "max-h-[90vh] overflow-y-auto"
          )}
          onInteractOutside={onClose}
          onEscapeKeyDown={onClose}
        >
          <div className="flex items-center justify-between">
            <h3 id={titleId} className="text-lg font-bold text-[var(--hisab-foreground)]">
              {title}
            </h3>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="بستن"
                className={cn(
                  "rounded-full p-1 text-[var(--hisab-muted-fg)]",
                  "hover:bg-[var(--hisab-muted)] hover:text-[var(--hisab-foreground)]",
                  "transition-colors"
                )}
              >
                <X className="size-4" aria-hidden />
              </button>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}