"use client"

import * as React from "react"
import { cn } from "../../lib/utils"
import { Eye, EyeOff } from "lucide-react"

// ============================================
// Input Props
// ============================================
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string | undefined
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  onRightIconClick?: () => void
  fullWidth?: boolean
}

// ============================================
// Input Component
// ============================================
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      onRightIconClick,
      fullWidth = true,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const inputId = id || React.useId()
    const [showPassword, setShowPassword] = React.useState(false)
    const isPassword = type === "password"
    const inputType = isPassword ? (showPassword ? "text" : "password") : type

    return (
      <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--hisab-foreground)] cursor-pointer select-none"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <span
              className={cn(
                "absolute start-3 top-1/2 -translate-y-1/2",
                "text-[var(--hisab-muted-fg)] pointer-events-none",
                "[&_svg]:size-4",
              )}
              aria-hidden="true"
            >
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={inputType}
            disabled={disabled}
            suppressHydrationWarning
            className={cn(
              "flex h-10 w-full rounded-[var(--hisab-radius)]",
              "border border-[var(--hisab-input)]",
              "bg-[var(--hisab-background)]",
              "text-[var(--hisab-foreground)]",
              "text-sm placeholder:text-[var(--hisab-muted-fg)]",
              "transition-all duration-[var(--hisab-transition)]",
              "focus:outline-none focus:ring-2",
              "focus:ring-[var(--hisab-ring)] focus:ring-offset-2",
              "focus:border-[var(--hisab-ring)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "disabled:bg-[var(--hisab-muted)]",
              error && "border-[var(--hisab-destructive)] focus:ring-[var(--hisab-destructive)]",
              leftIcon && "ps-10",
              (rightIcon || isPassword) && "pe-10",
              !leftIcon && !rightIcon && !isPassword && "px-3",
              type === "file" && "file:border-0 file:bg-transparent file:text-sm file:font-medium",
              className,
            )}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />

          {(rightIcon || isPassword) && (
            <button
              type="button"
              onClick={() => {
                if (isPassword) {
                  setShowPassword(!showPassword)
                } else {
                  onRightIconClick?.()
                }
              }}
              disabled={disabled}
              tabIndex={-1}
              className={cn(
                "absolute end-3 top-1/2 -translate-y-1/2",
                "text-[var(--hisab-muted-fg)]",
                "hover:text-[var(--hisab-foreground)]",
                "transition-colors duration-[var(--hisab-transition)]",
                "disabled:opacity-50 disabled:pointer-events-none",
                "[&_svg]:size-4",
              )}
              aria-label={isPassword ? (showPassword ? "Hide password" : "Show password") : undefined}
            >
              {isPassword ? (
                showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />
              ) : (
                rightIcon
              )}
            </button>
          )}
        </div>

        {error && (
          <p
            id={`${inputId}-error`}
            className="text-xs text-[var(--hisab-destructive)] animate-fade-in"
            role="alert"
          >
            {error}
          </p>
        )}

        {!error && helperText && (
          <p
            id={`${inputId}-helper`}
            className="text-xs text-[var(--hisab-muted-fg)]"
          >
            {helperText}
          </p>
        )}
      </div>
    )
  },
)
Input.displayName = "Input"

export { Input }