const puppeteer = require('C:/Users/hamed/node_modules/puppeteer')

async function run() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:64571',
    defaultViewport: null,
  })

  const target = browser.targets().find((t) => t.url().includes('hisabche.com'))
  const page = await target.page()

  const tableInputs = await page.evaluate(() => {
    const table = document.querySelector('table')
    if (!table) return null
    const rows = [...table.querySelectorAll('tbody tr')]
    return rows.map((tr, index) => {
      const inputs = [...tr.querySelectorAll('input')].map((i) => ({
        placeholder: i.placeholder,
        value: i.value,
        className: i.className,
      }))
      return { rowIndex: index, inputs }
    })
  })

  console.log('Table inputs:', JSON.stringify(tableInputs, null, 2))
  await browser.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
