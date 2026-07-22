// packages/ui/src/lib/activity/performance.ts

import { memo, useEffect, useState } from "react";

// ─── Debounce for search ──────────────────────────────────────────────────
export function useDebouncedSearch(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// ─── Memoized activity item ──────────────────────────────────────────────
export const MemoizedActivityItem = memo(ActivityItem, (prev, next) => {
  return (
    prev.activity.id === next.activity.id &&
    prev.activity.isRead === next.activity.isRead &&
    prev.isLast === next.isLast
  );
});

// ─── Image lazy loading ──────────────────────────────────────────────────
export const LazyImage = memo(function LazyImage({ src, alt, className }: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-[hsl(var(--surface-muted))] animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        className={cn(
          "transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
});