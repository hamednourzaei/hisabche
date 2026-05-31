"use client"

import * as React from "react"
import { cn } from "../../lib/utils"
import {
  Search,
  X,
  Clock,
  ArrowRight,
} from "lucide-react"

export interface SearchInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string
  onSearch?: (value: string) => void
  recentItems?: string[]
  frequentItems?: string[]
  showRecent?: boolean
  className?: string
}

const SearchInput = React.forwardRef<
  HTMLInputElement,
  SearchInputProps
>(
  (
    {
      className,
      placeholder = "جستجو...",
      onSearch,
      recentItems = [],
      frequentItems = [],
      showRecent = true,
      ...props
    },
    ref
  ) => {
    const [value, setValue] = React.useState("")
    const [isOpen, setIsOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    // Close on outside click
    React.useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        )
          setIsOpen(false)
      }
      document.addEventListener("mousedown", handler)
      return () =>
        document.removeEventListener("mousedown", handler)
    }, [])

    const handleChange = (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      setValue(e.target.value)
      setIsOpen(true)
      onSearch?.(e.target.value)
    }

    const handleSelect = (item: string) => {
      setValue(item)
      setIsOpen(false)
      onSearch?.(item)
    }

    const handleClear = () => {
      setValue("")
      onSearch?.("")
    }

    const filteredRecent = recentItems.filter((i) =>
      i.toLowerCase().includes(value.toLowerCase())
    )
    const filteredFrequent = frequentItems.filter((i) =>
      i.toLowerCase().includes(value.toLowerCase())
    )

    return (
      <div
        ref={containerRef}
        className={cn("relative", className)}
      >
        <div className="relative">
          <Search
            className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[var(--hisab-muted-fg)]"
            aria-hidden
          />
          <input
            ref={ref}
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className={cn(
              "h-10 w-full rounded-[var(--hisab-radius)] border border-[var(--hisab-border)] bg-[var(--hisab-background)] pe-10 ps-10 text-sm placeholder:text-[var(--hisab-muted-fg)] transition-all focus:outline-none focus:ring-2 focus:ring-[var(--hisab-ring)]"
            )}
            {...props}
          />
          {value && (
            <button
              onClick={handleClear}
              className="ghost-btn absolute end-3 top-1/2 -translate-y-1/2"
              aria-label="پاک کردن جستجو"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {isOpen &&
          (filteredRecent.length > 0 ||
            filteredFrequent.length > 0) && (
            <div className="glass-card absolute top-full z-50 mt-1 w-full animate-fade-in-up overflow-hidden">
              {showRecent &&
                filteredRecent.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--hisab-muted-fg)]">
                      <Clock className="size-3" aria-hidden />
                      اخیر
                    </div>
                    {filteredRecent
                      .slice(0, 5)
                      .map((item, i) => (
                        <button
                          key={`recent-${i}`}
                          onClick={() =>
                            handleSelect(item)
                          }
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--hisab-muted)] text-start"
                        >
                          <ArrowRight className="size-3 text-[var(--hisab-muted-fg)]" />
                          {item}
                        </button>
                      ))}
                  </div>
                )}

              {filteredFrequent.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--hisab-muted-fg)]">
                    پرتکرار
                  </div>
                  {filteredFrequent
                    .slice(0, 3)
                    .map((item, i) => (
                      <button
                        key={`freq-${i}`}
                        onClick={() =>
                          handleSelect(item)
                        }
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-[var(--hisab-muted)] text-start"
                      >
                        <ArrowRight className="size-3 text-[var(--hisab-muted-fg)]" />
                        {item}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
      </div>
    )
  }
)

SearchInput.displayName = "SearchInput"

export { SearchInput }