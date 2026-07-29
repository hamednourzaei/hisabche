// ═══════════════════════════════════════════════════════════
// apps/web/app/[lang]/login/page.tsx
// ═══════════════════════════════════════════════════════════
"use client"

import dynamic from "next/dynamic"

const LoginClient = dynamic(() => import("./LoginClient"), { ssr: false })

export default function LoginPage() {
  return <LoginClient />
}