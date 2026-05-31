export default function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--hisab-background)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--hisab-primary)] border-t-transparent" />
        <span className="text-sm text-[var(--hisab-muted-fg)]">
          در حال بارگذاری...
        </span>
      </div>
    </div>
  )
}