import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, label, leftIcon, rightIcon, ...props },
    ref
  ) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-[var(--hisab-foreground)]">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--hisab-muted-fg)]">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              "flex h-10 w-full rounded-md border border-[var(--hisab-border)] bg-[var(--hisab-background)] px-3 py-2 text-sm",
              "file:border-0 file:bg-transparent file:text-sm file:font-medium",
              "placeholder:text-[var(--hisab-muted-fg)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hisab-ring)] focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              leftIcon && "pe-9",
              rightIcon && "ps-9",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--hisab-muted-fg)]">
              {rightIcon}
            </div>
          )}
        </div>
      </div>
    )
  }
)

Input.displayName = "Input"

export { Input }