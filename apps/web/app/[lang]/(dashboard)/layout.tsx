import DashboardLayout from "./dashboard-layout"
export const metadata = {
  title: "داشبورد | حسابچه",
  description: "سیستم مدیریت فروش، انبار و حسابداری آنلاین برای کسب‌وکارهای کوچک و متوسط",
}
export default async function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>
}