const { chromium } = require('playwright')
const LIB = '/tmp/chromelibs/lib/aarch64-linux-gnu:/tmp/chromelibs/usr/lib/aarch64-linux-gnu'

;(async () => {
  const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: LIB } })

  // ---- Race test: slow tagged response arrives after clear ----
  console.log('######## RACE: tag request resolves AFTER clearing')
  const page = await browser.newPage()
  let gate
  const routeP = page.route('**/api/articles**', async route => {
    const url = route.request().url()
    if (url.includes('tag=')) {
      await gate
      console.log('  [route] tagged req released:', url.replace(/.*\/api/, '/api'))
    }
    return route.continue()
  })
  await page.goto('http://localhost:5173/')
  await page.waitForSelector('.article-card')
  gate = new Promise(r => setTimeout(r, 300)) // tagged req already? no, gate created after load; reset below
  // click tag; but route registered gate var at request time reads current `gate`
  await page.locator('.tag-list .el-tag', { hasText: 'Vue' }).first().click()
  await page.waitForTimeout(80)
  // immediately clear while tagged requests in flight
  await page.locator('.tag-list .el-tag', { hasText: '全部' }).click()
  await page.waitForTimeout(1200)
  const s = await page.evaluate(() => ({
    url: location.search,
    title: document.querySelector('.page-title').textContent.trim(),
    firstCard: document.querySelector('.article-card .article-title')?.textContent.trim(),
    active: [...document.querySelectorAll('.tag-list .el-tag')].filter(el =>
      el.classList.contains('el-tag--dark') && !el.classList.contains('el-tag--info'))
      .map(el => el.textContent.trim())
  }))
  console.log('STATE AFTER RACE:', JSON.stringify(s, null, 1))
  console.log('=> expected url="", title=最新文章, firstCard=Vite 构建工具入门与进阶, active=全部')
  await page.close()

  // ---- Empty / failed tags collection while ?tag= active ----
  console.log('\n######## TAGS EMPTY/FAIL with ?tag=Vue')
  for (const mode of ['empty', 'fail']) {
    const pg = await browser.newPage()
    await pg.route('**/api/tags**', route =>
      mode === 'fail' ? route.abort() : route.fulfill({ json: { tags: [] } }))
    await pg.goto('http://localhost:5173/?tag=Vue')
    await pg.waitForTimeout(600)
    const st = await pg.evaluate(() => ({
      chips: [...document.querySelectorAll('.tag-list .el-tag')].map(el => ({
        text: el.textContent.trim(),
        dark: el.classList.contains('el-tag--dark') && !el.classList.contains('el-tag--info')
      })),
      title: document.querySelector('.page-title').textContent.trim(),
      cards: document.querySelectorAll('.article-card').length
    }))
    console.log(mode, JSON.stringify(st))
    await pg.close()
  }

  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
