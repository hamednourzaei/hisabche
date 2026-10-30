const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')
const fs = require('fs')
const path = require('path')

const VIEWPORTS = [320, 360, 390, 430]
const CORE_HUBS = [
  { name: 'dashboard', path: '/en/dashboard' },
  { name: 'invoices', path: '/en/invoices' },
  { name: 'customers', path: '/en/customers' },
  { name: 'till', path: '/en/till' },
  { name: 'warehouse', path: '/en/warehouse' },
]

async function runDeepInspection() {
  console.log('=== STARTING DEEP HUMAN-LIKE QA EXECUTION ===')
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:63311',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  if (!target) {
    console.error('Target Hisabche page not found!')
    process.exit(1)
  }

  const page = await target.page()
  const cdp = await target.createCDPSession()

  const deepResults = {
    timestamp: new Date().toISOString(),
    formsAndModals: [],
    multiViewport: [],
    i18nRtlForms: [],
    controlsTriage: [],
  }

  // -------------------------------------------------------------
  // STEP 1: FORM & MODAL FIELD-BY-FIELD INSPECTION (DESKTOP)
  // -------------------------------------------------------------
  console.log('\n--- STEP 1: FIELD-BY-FIELD MODAL & FORM INSPECTION ---')
  await cdp.send('Emulation.clearDeviceMetricsOverride')
  await page.setViewport({ width: 1280, height: 800 })

  // 1.1 Customer Modal on /en/customers
  console.log('\n1.1 Inspecting Customer Modal on /en/customers...')
  try {
    await page.goto('https://hisabche.com/en/customers', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    await new Promise((r) => setTimeout(r, 2000))

    // Find and click "Add New Customer" button
    const openedModal = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const addBtn = buttons.find(
        (b) =>
          b.innerText.includes('Customer') ||
          b.innerText.includes('مشتری') ||
          b.innerText.includes('Add'),
      )
      if (addBtn) {
        addBtn.click()
        return true
      }
      return false
    })

    if (openedModal) {
      await new Promise((r) => setTimeout(r, 1500))
      // Capture screenshot of opened modal
      await page.screenshot({
        path: path.resolve('docs/qa/screenshots/modal-add-customer-desktop.png'),
      })

      // Inspect fields inside modal
      const modalFields = await page.evaluate(() => {
        const modal =
          document.querySelector('[role="dialog"]') ||
          document.querySelector('.modal') ||
          document.body
        const inputs = Array.from(modal.querySelectorAll('input, select, textarea')).map((el) => ({
          name: el.getAttribute('name') || el.getAttribute('id') || 'unnamed',
          type: el.getAttribute('type') || el.tagName.toLowerCase(),
          placeholder: el.getAttribute('placeholder') || '',
          value: el.value || '',
          required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
          disabled: el.disabled,
        }))

        // Try submitting empty to test validation
        const submitBtn = Array.from(modal.querySelectorAll('button')).find(
          (b) =>
            b.innerText.includes('Save') || b.innerText.includes('ذخیره') || b.type === 'submit',
        )
        if (submitBtn) {
          submitBtn.click()
        }

        return { inputs }
      })

      await new Promise((r) => setTimeout(r, 1000))
      // Capture validation state
      await page.screenshot({
        path: path.resolve('docs/qa/screenshots/modal-add-customer-validation.png'),
      })

      const validationText = await page.evaluate(() => {
        const errors = Array.from(
          document.querySelectorAll(
            '[class*="error"], [class*="destructive"], [role="alert"], p.text-red-500, span.text-red-500',
          ),
        )
          .map((e) => e.innerText.trim())
          .filter(Boolean)
        return errors
      })

      deepResults.formsAndModals.push({
        modal: 'Add Customer',
        fieldsCount: modalFields.inputs.length,
        fields: modalFields.inputs,
        emptySubmitErrors: validationText,
      })
      console.log(
        `  ✓ Add Customer Modal: ${modalFields.inputs.length} fields found. Validation errors on empty submit: ${JSON.stringify(validationText)}`,
      )

      // Close modal
      await page.evaluate(() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.innerText.includes('Cancel') || b.innerText.includes('انصراف'),
        )
        if (cancelBtn) cancelBtn.click()
      })
      await new Promise((r) => setTimeout(r, 1000))
    }
  } catch (err) {
    console.error('Error auditing customer modal:', err.message)
  }

  // 1.2 Invoice Builder Grid on /en/invoices/new
  console.log('\n1.2 Inspecting Invoice Builder on /en/invoices/new...')
  try {
    await page.goto('https://hisabche.com/en/invoices/new', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    await new Promise((r) => setTimeout(r, 2000))

    const builderInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map((el) => ({
        name:
          el.getAttribute('name') ||
          el.getAttribute('id') ||
          el.getAttribute('aria-label') ||
          'unnamed',
        type: el.getAttribute('type') || el.tagName.toLowerCase(),
        placeholder: el.getAttribute('placeholder') || '',
        value: el.value || '',
        ariaLabel: el.getAttribute('aria-label') || '',
      }))

      const buttons = Array.from(document.querySelectorAll('button')).map((b) => ({
        text: b.innerText.trim().slice(0, 40),
        disabled: b.disabled,
        title: b.getAttribute('title') || b.getAttribute('aria-label') || '',
      }))

      return {
        inputsCount: inputs.length,
        inputsSample: inputs.slice(0, 10),
        buttonsCount: buttons.length,
        buttonsSample: buttons.slice(0, 10),
      }
    })

    deepResults.formsAndModals.push({
      modal: 'Invoice Builder',
      ...builderInfo,
    })
    console.log(
      `  ✓ Invoice Builder: ${builderInfo.inputsCount} inputs, ${builderInfo.buttonsCount} buttons detected.`,
    )
  } catch (err) {
    console.error('Error auditing invoice builder:', err.message)
  }

  // -------------------------------------------------------------
  // STEP 2: MULTI-VIEWPORT RESPONSIVE AUDIT (320, 360, 390, 430px)
  // -------------------------------------------------------------
  console.log('\n--- STEP 2: MULTI-VIEWPORT RESPONSIVE AUDIT (320, 360, 390, 430px) ---')
  for (const width of VIEWPORTS) {
    console.log(`\nEvaluating Viewport: ${width}px...`)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: width,
      height: 800,
      deviceScaleFactor: 2,
      mobile: true,
    })

    for (const hub of CORE_HUBS) {
      try {
        await page.goto(`https://hisabche.com${hub.path}`, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        })
        await new Promise((r) => setTimeout(r, 1200))

        const metrics = await page.evaluate((w) => {
          const scrollWidth = document.documentElement.scrollWidth
          const clientWidth = document.documentElement.clientWidth
          const overflowDelta = scrollWidth - clientWidth
          const hasOverflow = overflowDelta > 2 // Allow minor 1-2px subpixel difference

          // Small touch targets (< 44px)
          const interactives = Array.from(document.querySelectorAll('button, a, input, select'))
          const sub44 = interactives
            .filter((el) => {
              const rect = el.getBoundingClientRect()
              return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
            })
            .map((el) => ({
              tag: el.tagName,
              text: el.innerText.trim().slice(0, 20),
              w: Math.round(el.getBoundingClientRect().width),
              h: Math.round(el.getBoundingClientRect().height),
            }))

          return {
            targetWidth: w,
            clientWidth,
            scrollWidth,
            hasOverflow,
            overflowDelta,
            sub44Count: sub44.length,
            sub44Sample: sub44.slice(0, 5),
          }
        }, width)

        // Capture screenshot
        const shotPath = path.resolve(`docs/qa/screenshots/resp-${width}px-${hub.name}.png`)
        await page.screenshot({ path: shotPath, fullPage: true })

        deepResults.multiViewport.push({
          width,
          hub: hub.name,
          ...metrics,
          screenshot: path.basename(shotPath),
        })

        console.log(
          `  [${width}px] ${hub.name}: Overflow=${metrics.hasOverflow} (+${metrics.overflowDelta}px), Sub-44px targets=${metrics.sub44Count}`,
        )
      } catch (err) {
        console.error(`  Error on ${hub.name} at ${width}px:`, err.message)
      }
    }
  }

  // Clear emulation
  await cdp.send('Emulation.clearDeviceMetricsOverride')
  await page.setViewport({ width: 1280, height: 800 })

  // -------------------------------------------------------------
  // STEP 3: DEEP I18N & RTL FORM & MODAL AUDIT (FA & AF)
  // -------------------------------------------------------------
  console.log('\n--- STEP 3: DEEP I18N & RTL FORM & MODAL AUDIT (FA & AF) ---')

  // 3.1 Persian Modal on /fa/customers
  console.log('\n3.1 Testing Persian Form on /fa/customers...')
  try {
    await page.goto('https://hisabche.com/fa/customers', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    await new Promise((r) => setTimeout(r, 2000))

    const faModalOpened = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const addBtn = buttons.find(
        (b) => b.innerText.includes('مشتری جدید') || b.innerText.includes('افزودن'),
      )
      if (addBtn) {
        addBtn.click()
        return true
      }
      return false
    })

    if (faModalOpened) {
      await new Promise((r) => setTimeout(r, 1500))
      await page.screenshot({ path: path.resolve('docs/qa/screenshots/fa-add-customer-modal.png') })

      const faModalData = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]') || document.body
        const direction = window.getComputedStyle(modal).direction
        const inputs = Array.from(modal.querySelectorAll('input, select, textarea')).map((el) => ({
          name: el.getAttribute('name') || el.getAttribute('id') || '',
          placeholder: el.getAttribute('placeholder') || '',
          dir: window.getComputedStyle(el).direction,
        }))

        // Click save to trigger Persian validation
        const saveBtn = Array.from(modal.querySelectorAll('button')).find((b) =>
          b.innerText.includes('ذخیره'),
        )
        if (saveBtn) saveBtn.click()

        return { direction, inputs }
      })

      await new Promise((r) => setTimeout(r, 1000))
      await page.screenshot({
        path: path.resolve('docs/qa/screenshots/fa-customer-modal-validation.png'),
      })

      const faErrors = await page.evaluate(() => {
        return Array.from(
          document.querySelectorAll(
            '[class*="error"], [class*="destructive"], [role="alert"], p.text-red-500, span.text-red-500',
          ),
        )
          .map((e) => e.innerText.trim())
          .filter(Boolean)
      })

      deepResults.i18nRtlForms.push({
        locale: 'fa',
        form: 'Add Customer Modal',
        direction: faModalData.direction,
        inputs: faModalData.inputs,
        validationErrors: faErrors,
      })
      console.log(
        `  ✓ Persian Customer Modal: Dir=${faModalData.direction}, ValidationErrors=${JSON.stringify(faErrors)}`,
      )

      // Close modal
      await page.evaluate(() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find((b) =>
          b.innerText.includes('انصراف'),
        )
        if (cancelBtn) cancelBtn.click()
      })
      await new Promise((r) => setTimeout(r, 1000))
    }
  } catch (err) {
    console.error('Error on Persian customer modal:', err.message)
  }

  // 3.2 Dari Invoice Builder on /af/invoices/new
  console.log('\n3.2 Testing Dari Invoice Builder on /af/invoices/new...')
  try {
    await page.goto('https://hisabche.com/af/invoices/new', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    await new Promise((r) => setTimeout(r, 2000))
    await page.screenshot({ path: path.resolve('docs/qa/screenshots/af-invoice-new.png') })

    const afBuilderData = await page.evaluate(() => {
      const bodyDir = window.getComputedStyle(document.body).direction
      const h1Text = document.querySelector('h1')
        ? document.querySelector('h1').innerText.trim()
        : ''
      const tableHeaders = Array.from(document.querySelectorAll('th, [role="columnheader"]'))
        .map((th) => th.innerText.trim())
        .filter(Boolean)

      return {
        bodyDir,
        h1Text,
        tableHeaders,
        snippet: document.body.innerText.slice(0, 400).replace(/\n+/g, ' | '),
      }
    })

    deepResults.i18nRtlForms.push({
      locale: 'af',
      screen: 'New Invoice',
      ...afBuilderData,
    })
    console.log(
      `  ✓ Dari New Invoice: Dir=${afBuilderData.bodyDir}, H1="${afBuilderData.h1Text}", Headers=${JSON.stringify(afBuilderData.tableHeaders.slice(0, 6))}`,
    )
  } catch (err) {
    console.error('Error on Dari invoice builder:', err.message)
  }

  // -------------------------------------------------------------
  // STEP 4: CONTROL TRIAGE (CLASS A / CLASS B / CLASS C)
  // -------------------------------------------------------------
  console.log('\n--- STEP 4: CONTROL TRIAGE ACROSS CORE HUBS ---')
  await page.goto('https://hisabche.com/en/dashboard', {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  })
  await new Promise((r) => setTimeout(r, 2000))

  const triageData = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
      .map((b) => {
        const text = b.innerText.trim()
        const disabled = b.disabled
        const ariaDisabled = b.getAttribute('aria-disabled') === 'true'
        let triageClass = 'Class B'
        let reason = 'Active interactive control'

        if (
          text.includes('Delete') ||
          text.includes('Remove') ||
          text.includes('Close Till') ||
          text.includes('Finalize') ||
          text.includes('Pay')
        ) {
          triageClass = 'Class C'
          reason = 'Financial mutation or irreversible operation on live production'
        } else if (disabled || ariaDisabled) {
          triageClass = 'Class B'
          reason = b.getAttribute('title') || 'Disabled by validation/state'
        } else {
          triageClass = 'Class B'
          reason = 'Standard safe interactive control'
        }

        return {
          text: text.slice(0, 40),
          disabled: disabled || ariaDisabled,
          triageClass,
          reason,
        }
      })
      .filter((b) => b.text)

    return buttons
  })

  deepResults.controlsTriage = triageData.slice(0, 30)
  console.log(
    `  ✓ Inventoried ${triageData.length} controls on Dashboard. Sample triage:`,
    triageData.slice(0, 5),
  )

  // Save full results
  const outPath = path.resolve('docs/qa/deep-qa-results.json')
  fs.writeFileSync(outPath, JSON.stringify(deepResults, null, 2), 'utf-8')
  console.log(`\n=== DEEP HUMAN-LIKE QA EXECUTION COMPLETED ===`)
  console.log(`Results saved to: ${outPath}`)

  await browser.disconnect()
}

runDeepInspection().catch((err) => {
  console.error('Fatal in Deep QA Runner:', err)
  process.exit(1)
})
