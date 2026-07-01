// ============================================
// apps/web/src/app/sitemap.ts
// ============================================

import { MetadataRoute } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.hisabche.com'

// این تابع از دیتابیس برای گرفتن لیست واقعی محصولات استفاده می‌کند
async function getProducts() {
  // اینجا از Supabase یا API خودتان استفاده کنید
  const response = await fetch(`${baseUrl}/api/products?limit=1000`)
  const data = await response.json()
  return data.products || []
}

// این تابع برای گرفتن لیست واقعی فاکتورها
async function getInvoices() {
  const response = await fetch(`${baseUrl}/api/invoices?limit=1000`)
  const data = await response.json()
  return data.invoices || []
}

// این تابع برای گرفتن لیست واقعی مشتریان
async function getCustomers() {
  const response = await fetch(`${baseUrl}/api/customers?limit=1000`)
  const data = await response.json()
  return data.customers || []
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString()

  // ۱. صفحات استاتیک
  const staticPages = [
    { url: baseUrl, lastModified: now, changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: `${baseUrl}/dashboard`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/invoices`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/godam`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/baqidari`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${baseUrl}/settings`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${baseUrl}/login`, lastModified: now, changeFrequency: 'yearly' as const, priority: 0.3 },
  ]

  // ۲. صفحات پویا (محصولات)
  const products = await getProducts()
  const productPages = products.map((product: any) => ({
    url: `${baseUrl}/godam/${product.id}`,
    lastModified: product.updatedAt || product.createdAt || now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
    images: product.imageUrl ? [product.imageUrl] : undefined,
  }))

  // ۳. صفحات پویا (فاکتورها)
  const invoices = await getInvoices()
  const invoicePages = invoices.map((invoice: any) => ({
    url: `${baseUrl}/invoices/${invoice.id}`,
    lastModified: invoice.updatedAt || invoice.createdAt || now,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  // ۴. صفحات پویا (مشتریان)
  const customers = await getCustomers()
  const customerPages = customers.map((customer: any) => ({
    url: `${baseUrl}/baqidari/${customer.id}`,
    lastModified: customer.updatedAt || customer.createdAt || now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  return [
    ...staticPages,
    ...productPages,
    ...invoicePages,
    ...customerPages,
  ]
}