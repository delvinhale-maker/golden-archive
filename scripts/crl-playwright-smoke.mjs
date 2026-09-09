import { chromium } from 'playwright'

const baseURL = process.env.CRL_BASE_URL ?? 'http://127.0.0.1:4173'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

try {
  const response = await page.goto(`${baseURL}/creator-rights-ledger`, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  })

  if (!response || response.status() >= 500) {
    throw new Error(`Creator Rights Ledger route returned ${response?.status() ?? 'no response'}`)
  }

  await page.waitForURL((url) => {
    return url.pathname === '/auth' || url.pathname === '/creator-rights-ledger'
  }, { timeout: 10_000 })

  const url = new URL(page.url())
  if (url.pathname === '/auth') {
    const redirect = url.searchParams.get('redirect')
    if (redirect !== '/creator-rights-ledger') {
      throw new Error(`Auth guard did not preserve CRL return path; got ${redirect}`)
    }
  }

  console.log(`CRL Playwright smoke passed at ${url.pathname}`)
} finally {
  await browser.close()
}
