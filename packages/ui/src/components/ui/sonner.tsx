"use client"

import { Toaster as Sonner } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({
  theme = "system",
  ...props
}: ToasterProps) => {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon
            className="size-4"
            aria-hidden
          />
        ),
        info: (
          <InfoIcon
            className="size-4"
            aria-hidden
          />
        ),
        warning: (
          <TriangleAlertIcon
            className="size-4"
            aria-hidden
          />
        ),
        error: (
          <OctagonXIcon
            className="size-4"
            aria-hidden
          />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg":
            "hsl(var(--hisab-popover))",
          "--normal-text":
            "hsl(var(--hisab-popover-fg))",
          "--normal-border":
            "hsl(var(--hisab-border))",
          "--border-radius":
            "var(--hisab-radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }