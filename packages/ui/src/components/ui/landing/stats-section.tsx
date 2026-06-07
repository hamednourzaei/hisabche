"use client"

import { useState, useEffect, useRef } from "react"

interface StatItem { end: number; label: string }

function AnimatedCounter({ end, label }: StatItem) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !started.current) {
        started.current = true
        
        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        if (prefersReduced) { 
          setCount(end)
          return 
        }
        
        const duration = 1400
        const startTime = performance.now()
        
        const tick = (now: number) => {
          const progress = Math.min((now - startTime) / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          setCount(Math.round(eased * end))
          if (progress < 1) requestAnimationFrame(tick)
        }
        
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    
    observer.observe(el)
    return () => observer.disconnect()
  }, [end])

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl font-bold tabular-nums text-foreground md:text-5xl">
        {count.toLocaleString("fa-IR")}
        <span className="text-primary">+</span>
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{label}</div>
    </div>
  )
}

const stats: StatItem[] = [
  { end: 1250, label: "فاکتور صادر شده" },
  { end: 340, label: "کسب‌وکار فعال" },
  { end: 8, label: "شهر افغانستان" },
]

export default function StatsSection() {
  return (
    <section className="border-y border-border bg-card/30 py-16 px-6">
      <div className="mx-auto grid max-w-3xl grid-cols-3 gap-8">
        {stats.map((s) => <AnimatedCounter key={s.label} {...s} />)}
      </div>
    </section>
  )
}