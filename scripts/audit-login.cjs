const puppeteer = require('puppeteer')

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=fa'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('https://hisabche.com/fa/login', { waitUntil: 'networkidle2', timeout: 30000 })

  const emailInput = await page.$('input[type="email"], input[name="email"]')
  const passwordInput = await page.$('input[type="password"], input[name="password"]')

  console.log('Inputs found:', !!emailInput, !!passwordInput)
  if (emailInput && passwordInput) {
    await emailInput.type('tsarpremiumstream@gmail.com', { delay: 30 })
    await passwordInput.type('11223344Hamed', { delay: 30 })

    const submitBtn = await page.$('button[type="submit"]')
    console.log('Submit button found:', !!submitBtn)
    if (submitBtn) {
      await Promise.all([
        page
          .waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
          .catch((e) => console.log('Nav note:', e.message)),
        submitBtn.click(),
      ])
    }
  }

  // Wait a bit for client hydration
  await new Promise((r) => setTimeout(r, 4000))

  console.log('Current URL after login attempt:', page.url())
  console.log('Page Title:', await page.title())
  await page.screenshot({ path: 'docs/audit/exchange/screenshot-02-after-login.png' })
  console.log('Screenshot 02 saved!')
  await browser.close()
})()
