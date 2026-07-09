// apps/web/e2e/critical-paths.spec.ts
import { test, expect } from '@playwright/test'

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'

test.describe('Critical Paths', () => {
  
  // ============================================
  // LOGIN
  // ============================================
  test('login with demo account', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    
    // Wait for form to render
    await page.waitForSelector('input[type="email"]')
    
    // Fill credentials
    await page.fill('input[type="email"]', 'demo@hisabche.com')
    await page.fill('input[type="password"]', 'Demo1234')
    
    // Click login
    await page.click('button[type="submit"]')
    
    // Should redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 10000 })
    
    // Verify dashboard loaded
    await expect(page.locator('h1')).toContainText(['داشبورد', 'Dashboard'])
  })

  // ============================================
  // QUICK INVOICE
  // ============================================
  test('create quick invoice', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', 'demo@hisabche.com')
    await page.fill('input[type="password"]', 'Demo1234')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 10000 })

    // Navigate to quick invoice
    await page.goto(`${BASE_URL}/quick-invoice`)
    await page.waitForLoadState('networkidle')

    // Step 1: Select product
    await page.waitForSelector('text=نام محصول')
    await page.click('[data-testid="product-picker"]')
    await page.waitForSelector('[role="listbox"]')
    await page.click('[role="option"]:first-child')
    await page.click('text=ادامه')

    // Step 2: Skip customer (optional)
    await page.waitForSelector('text=مشتری')
    await page.click('text=ادامه')

    // Step 3: Set price
    await page.waitForSelector('text=مبلغ فاکتور')
    await page.fill('input[type="number"]', '500')
    await page.click('text=ثبت فاکتور')

    // Step 4: Done
    await page.waitForSelector('text=فاکتور ثبت شد', { timeout: 10000 })
    await expect(page.locator('text=فاکتور ثبت شد')).toBeVisible()
  })

  // ============================================
  // VIEW INVOICES
  // ============================================
  test('view invoices list', async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', 'demo@hisabche.com')
    await page.fill('input[type="password"]', 'Demo1234')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 10000 })

    // Navigate to invoices
    await page.goto(`${BASE_URL}/invoices`)
    await page.waitForLoadState('networkidle')

    // Should show invoices page
    await expect(page.locator('h1')).toContainText(['فاکتورها', 'Invoices'])
  })

  // ============================================
  // NAVIGATION
  // ============================================
  test('navigate between pages', async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', 'demo@hisabche.com')
    await page.fill('input[type="password"]', 'Demo1234')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 10000 })

    // Dashboard → warehouse
    await page.click('text=انبار')
    await page.waitForURL('**/warehouse**')
    await expect(page.locator('h1')).toContainText(['گدام', 'warehouse'])

    // warehouse → Dashboard
    await page.click('text=داشبورد')
    await page.waitForURL('**/dashboard**')

    // Dashboard → Settings
    await page.click('text=تنظیمات')
    await page.waitForURL('**/settings**')
    await expect(page.locator('h1')).toContainText(['تنظیمات', 'Settings'])
  })

  // ============================================
  // LOGOUT
  // ============================================
  test('logout', async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', 'demo@hisabche.com')
    await page.fill('input[type="password"]', 'Demo1234')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 10000 })

    // Logout
    await page.click('[aria-label="خروج"]')
    await page.waitForURL('**/login**')
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })
})