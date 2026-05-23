"use client"

import * as React from "react"
import { cn } from "../../lib/utils"
import { Search, X, Clock, ArrowRight } from "lucide-react"

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string
  onSearch?: (value: string) => void
  recentItems?: string[]
  frequentItems?: string[]
  showRecent?: boolean
  className?: string
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, placeholder = "جستجو...", onSearch, recentItems = [], frequentItems = [], showRecent = true, ...props }, ref) => {
    const [value, setValue] = React.useState("")
    const [isOpen, setIsOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
      const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false) }
      document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { setValue(e.target.value); setIsOpen(true); onSearch?.(e.target.value) }
    const handleSelect = (item: string) => { setValue(item); setIsOpen(false); onSearch?.(item) }
    const handleClear = () => { setValue(""); onSearch?.("") }

    const filteredRecent = recentItems.filter((i) => i.toLowerCase().includes(value.toLowerCase()))
    const filteredFrequent = frequentItems.filter((i) => i.toLowerCase().includes(value.toLowerCase()))

    return (
      <div ref={containerRef} className={cn("relative", className)}>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[var(--hisab-muted-fg)]" />
          <input ref={ref} type="text" value={value} onChange={handleChange} onFocus={() => setIsOpen(true)} placeholder={placeholder}
            className={cn("w-full h-10 ps-10 pe-10 rounded-[var(--hisab-radius)] border border-[var(--hisab-border)] bg-[var(--hisab-background)] text-sm placeholder:text-[var(--hisab-muted-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--hisab-ring)] transition-all")} {...props} />
          {value && <button onClick={handleClear} className="ghost-btn absolute end-3 top-1/2 -translate-y-1/2"><X className="size-4" /></button>}
        </div>

        {isOpen && (filteredRecent.length > 0 || filteredFrequent.length > 0) && (
          <div className="glass-card absolute top-full mt-1 w-full z-50 overflow-hidden animate-fade-in-up">
            {showRecent && filteredRecent.length > 0 && (
              <div>
                <div className="px-3 py-2 text-[10px] font-semibold text-[var(--hisab-muted-fg)] uppercase tracking-wider flex items-center gap-1"><Clock className="size-3" />اخیر</div>
                {filteredRecent.slice(0, 5).map((item, i) => (
                  <button key={`recent-${i}`} onClick={() => handleSelect(item)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--hisab-muted)] transition-colors">
                    <ArrowRight className="size-3 text-[var(--hisab-muted-fg)]" />{item}
                  </button>
                ))}
              </div>
            )}
            {filteredFrequent.length > 0 && (
              <div>
                <div className="px-3 py-2 text-[10px] font-semibold text-[var(--hisab-muted-fg)] uppercase tracking-wider">پرتکرار</div>
                {filteredFrequent.slice(0, 3).map((item, i) => (
                  <button key={`freq-${i}`} onClick={() => handleSelect(item)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--hisab-muted)] transition-colors">
                    <ArrowRight className="size-3 text-[var(--hisab-muted-fg)]" />{item}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  },
)
SearchInput.displayName = "SearchInput"

export { SearchInput }