// ═══════════════════════════════════════════════════════════
// apps/web/app/signup/page.tsx
// ═══════════════════════════════════════════════════════════
"use client"

import dynamic from "next/dynamic"

const LoginClient = dynamic(() => import("./LoginClient"), { ssr: false })

export default function SignupPage() {
  return <LoginClient />
}