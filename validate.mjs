import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'

const EDGE_PATH = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
const BASE = 'http://localhost:3000'
const SHOTS = '/tmp/validate-shots'
mkdirSync(SHOTS, { recursive: true })

let passed = 0
let failed = 0

function log(label, ok, detail = '') {
  const mark = ok ? '✓' : '✗'
  console.log(`  ${mark} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) passed++; else failed++
}

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
}

// Wait for server
async function waitForServer(retries = 15) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(`${BASE}/login`)
      if (r.status < 500) return
    } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error('Dev server did not start')
}

await waitForServer()

const browser = await chromium.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox'],
})

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()

// ── 1. Unauthenticated auth guard ─────────────────────────────────────────
console.log('\n[1] Auth guard — unauthenticated redirects')

await page.goto(`${BASE}/trips`, { waitUntil: 'networkidle' })
await shot(page, '01-trips-unauth')
log('GET /trips  → redirected to /login', page.url().includes('/login'), page.url())

await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
log('GET /settings → redirected to /login', page.url().includes('/login'), page.url())

// ── 2. Login page ─────────────────────────────────────────────────────────
console.log('\n[2] Login page')

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await shot(page, '02-login-desktop')
log('Login page loads at /login', page.url().includes('/login'))
log('Google button present', await page.locator('button', { hasText: /google/i }).count() > 0)
log('Email input present', await page.locator('input[type="email"]').count() > 0)
log('Magic link button present', await page.locator('button', { hasText: /magic link/i }).count() > 0)
const loginErr = await page.locator('text=Application error').count()
log('No application error on login', loginErr === 0)

// ── 3. PWA manifest & icons ───────────────────────────────────────────────
console.log('\n[3] PWA')

const mRes = await fetch(`${BASE}/manifest.json`)
log('manifest.json returns 200', mRes.status === 200, `status=${mRes.status}`)
const manifest = await mRes.json()
log('display: standalone', manifest?.display === 'standalone')
log('icons array not empty', Array.isArray(manifest?.icons) && manifest.icons.length > 0)

const svgRes = await fetch(`${BASE}/icon.svg`)
log('icon.svg returns 200', svgRes.status === 200, `status=${svgRes.status}`)

// ── 4. HTML <head> ────────────────────────────────────────────────────────
console.log('\n[4] HTML <head>')

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
const hasManifestLink = await page.locator('link[rel="manifest"]').count() > 0
log('<link rel="manifest"> present', hasManifestLink)
const hasIconLink = await page.locator('link[rel="icon"]').count() > 0
log('<link rel="icon"> present', hasIconLink)

// ── 5. Shell layout renders without crashing ──────────────────────────────
console.log('\n[5] Shell components compile & load')
// Can only check login page render since we're not authenticated
const html = await page.content()
log('No hydration/server error text in DOM', !html.includes('Application error') && !html.includes('Unhandled Runtime Error'))

// ── 6. Mobile viewport ────────────────────────────────────────────────────
console.log('\n[6] Mobile viewport (390×844)')

const mCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const mPage = await mCtx.newPage()
await mPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await mPage.screenshot({ path: `${SHOTS}/06-login-mobile.png` })
const mErr = await mPage.locator('text=Application error').count()
log('Login renders on mobile without error', mErr === 0)
await mCtx.close()

// ── 7. Root / redirects ───────────────────────────────────────────────────
console.log('\n[7] Root path')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
log('GET / does not 500', !page.url().includes('500'))
await shot(page, '07-root')

// ── Summary ───────────────────────────────────────────────────────────────
await browser.close()
console.log(`\nScreenshots: ${SHOTS}/`)
console.log(`\nResult: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
