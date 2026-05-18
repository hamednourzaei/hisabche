"use client"

interface LoadingScreenProps {
  message: string
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--hisab-background)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[var(--hisab-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--hisab-muted-fg)] text-sm">{message}</p>
      </div>
    </div>
  )
}