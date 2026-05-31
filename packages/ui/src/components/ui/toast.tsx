"use client"

import * as React from "react"
import { cn } from "../../lib/utils"
import {
  X,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
} from "lucide-react"

// ═══ Types ═══
export type ToastVariant =
  | "default"
  | "success"
  | "error"
  | "warning"
  | "info"

export interface ToastProps {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
  onDismiss?: (id: string) => void
}

// ═══ Icons ═══
const toastIcons: Record<ToastVariant, React.ReactNode> = {
  default: null,
  success: (
    <CheckCircle
      className="size-5 text-[var(--hisab-success)]"
      aria-hidden
    />
  ),
  error: (
    <AlertCircle
      className="size-5 text-[var(--hisab-destructive)]"
      aria-hidden
    />
  ),
  warning: (
    <AlertTriangle
      className="size-5 text-[var(--hisab-warning)]"
      aria-hidden
    />
  ),
  info: (
    <Info
      className="size-5 text-[var(--hisab-info)]"
      aria-hidden
    />
  ),
}

// ═══ Styles ═══
const toastStyles: Record<ToastVariant, string> = {
  default: "border-[var(--hisab-border)]",
  success:
    "border-[var(--hisab-success)]/30 bg-[var(--hisab-success)]/5",
  error:
    "border-[var(--hisab-destructive)]/30 bg-[var(--hisab-destructive)]/5",
  warning:
    "border-[var(--hisab-warning)]/30 bg-[var(--hisab-warning)]/5",
  info: "border-[var(--hisab-info)]/30 bg-[var(--hisab-info)]/5",
}

// ═══ Toast Component ═══
const Toast = React.forwardRef<
  HTMLDivElement,
  ToastProps & React.HTMLAttributes<HTMLDivElement>
>(
  (
    {
      id,
      title,
      description,
      variant = "default",
      duration = 5000,
      onDismiss,
      className,
      ...props
    },
    ref
  ) => {
    const [isVisible, setIsVisible] =
      React.useState(true)
    const [isLeaving, setIsLeaving] =
      React.useState(false)
    const timerRef =
      React.useRef<ReturnType<typeof setTimeout>>()

    const handleDismiss = React.useCallback(() => {
      setIsLeaving(true)
      setTimeout(() => {
        setIsVisible(false)
        onDismiss?.(id)
      }, 200)
    }, [id, onDismiss])

    React.useEffect(() => {
      if (duration > 0) {
        timerRef.current = setTimeout(
          handleDismiss,
          duration
        )
      }
      return () => {
        if (timerRef.current)
          clearTimeout(timerRef.current)
      }
    }, [duration, handleDismiss])

    if (!isVisible) return null

    return (
      <div
        ref={ref}
        suppressHydrationWarning
        role="status"
        aria-live="polite"
        className={cn(
          "flex w-full max-w-sm items-start gap-3",
          "rounded-[var(--hisab-radius-lg)]",
          "border bg-[var(--hisab-background)]",
          "p-4 shadow-[var(--hisab-shadow-lg)]",
          "animate-slide-up",
          isLeaving && "animate-fade-out opacity-0",
          toastStyles[variant],
          className
        )}
        {...props}
      >
        {toastIcons[variant] && (
          <span className="mt-0.5 shrink-0">
            {toastIcons[variant]}
          </span>
        )}

        <div className="min-w-0 flex-1 text-start">
          {title && (
            <p className="text-sm font-semibold text-[var(--hisab-foreground)]">
              {title}
            </p>
          )}
          {description && (
            <p className="mt-0.5 text-sm text-[var(--hisab-muted-fg)]">
              {description}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className={cn(
            "shrink-0 rounded-full p-1",
            "text-[var(--hisab-muted-fg)]",
            "hover:bg-[var(--hisab-muted)] hover:text-[var(--hisab-foreground)]",
            "transition-colors duration-[var(--hisab-duration)]"
          )}
          aria-label="Dismiss notification"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    )
  }
)
Toast.displayName = "Toast"

// ═══ Toast Container ═══
export interface ToastContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  position?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center"
}

const positionStyles: Record<
  NonNullable<ToastContainerProps["position"]>,
  string
> = {
  "top-right": "top-4 end-4",
  "top-left": "top-4 start-4",
  "bottom-right": "bottom-4 end-4",
  "bottom-left": "bottom-4 start-4",
  "top-center":
    "top-4 start-1/2 -translate-x-1/2",
  "bottom-center":
    "bottom-4 start-1/2 -translate-x-1/2",
}

const ToastContainer = React.forwardRef<
  HTMLDivElement,
  ToastContainerProps
>(
  (
    {
      position = "bottom-right",
      className,
      children,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col gap-2",
        positionStyles[position],
        className
      )}
      aria-label="Notifications"
      {...props}
    >
      {children}
    </div>
  )
)
ToastContainer.displayName = "ToastContainer"

export { Toast, ToastContainer }