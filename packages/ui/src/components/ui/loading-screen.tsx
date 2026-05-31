"use client"

interface LoadingScreenProps {
  message: string
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--hisab-background)]">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--hisab-primary)] border-t-transparent"
          aria-hidden
        />
        <p
          className="text-sm text-[var(--hisab-muted-fg)]"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      </div>
    </div>
  )
}