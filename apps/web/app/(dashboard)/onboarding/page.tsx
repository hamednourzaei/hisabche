// apps/web/app/(dashboard)/onboarding/page.tsx
import { OnboardingContainer } from "@hisabche/ui"

export const metadata = {
  title: "راه‌اندازی | حسابچه",
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <main className="section">
      <OnboardingContainer />
    </main>
  )
}