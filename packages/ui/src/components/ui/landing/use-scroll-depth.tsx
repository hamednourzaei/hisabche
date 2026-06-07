"use client"

import { useEffect } from "react"

export function useScrollDepth() {
  useEffect(() => {
    const checkpoints = [25, 50, 75, 100]
    const fired = new Set<number>()

    const onScroll = () => {
      const scrollTop = window.scrollY
      const height = document.body.scrollHeight - window.innerHeight
      const percent = Math.round((scrollTop / height) * 100)

      checkpoints.forEach((p) => {
        if (percent >= p && !fired.has(p)) {
          fired.add(p)
          // analytics hook
          console.log("scroll_depth", p)
        }
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
}