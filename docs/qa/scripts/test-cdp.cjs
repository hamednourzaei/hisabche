const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function testConnection() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  console.log('Connected to CDP!')
  const targets = browser.targets()
  console.log(
    'Targets:',
    targets.map((t) => ({ type: t.type(), url: t.url() })),
  )

  const target = targets.find((t) => t.url().includes('hisabche.com'))
  if (!target) {
    console.error('Target not found')
    process.exit(1)
  }

  const page = await target.page()
  console.log('Current Page Title:', await page.title())
  console.log('Current URL:', page.url())
}

testConnection().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
