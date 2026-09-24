const { chromium } = require('playwright')
const LIB = '/tmp/chromelibs/lib/aarch64-linux-gnu:/tmp/chromelibs/usr/lib/aarch64-linux-gnu'

;(async () => {
  const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: LIB } })
  const page = await browser.newPage()

  // Hold tagged responses; release non-tag immediately
  let releaseTagged
  const taggedHeld = new Promise(r => { releaseTagged = r })
  let heldCount = 0
  await page.route('**/api/articles**', async route => {
    const url = route.request().url()
    if (url.includes('tag=')) {
      heldCount++
      console.log('  [route] HOLD tagged:', url.replace(/.*\/api/, '/api'))
      await taggedHeld
    }
    return route.continue()
  })

  await page.goto('http://localhost:5173/')
  await page.waitForSelector('.article-card')
  console.log('home loaded')
  // Now arm: clicking tag fires held requests. Route callback checks at invocation, fine.
  await page.locator('.tag-list .el-tag', { hasText: 'Vue' }).first().click()
  await page.waitForTimeout(300)
  console.log('clicked Vue, held tagged requests so far:', heldCount)
  // Click 全部 while tagged requests are in flight; its (non-tag) request returns at once
  await page.locator('.tag-list .el-tag', { hasText: '全部' }).click()
  await page.waitForTimeout(400)
  const early = await page.evaluate(() => ({
    url: location.search,
    title: document.querySelector('.page-title').textContent.trim(),
    firstCard: document.querySelector('.article-card .article-title')?.textContent.trim()
  }))
  console.log('BEFORE stale resp released:', JSON.stringify(early))
  // now the stale tagged responses land
  releaseTagged()
  await page.waitForTimeout(800)
  const late = await page.evaluate(() => ({
    url: location.search,
    title: document.querySelector('.page-title').textContent.trim(),
    firstCard: document.querySelector('.article-card .article-title')?.textContent.trim(),
    active: [...document.querySelectorAll('.tag-list .el-tag')].filter(el =>
      el.classList.contains('el-tag--dark') && !el.classList.contains('el-tag--info'))
      .map(el => el.textContent.trim())
  }))
  console.log('AFTER stale resp landed :', JSON.stringify(late))
  console.log(late.url === '' && late.title === '最新文章'
    && late.firstCard === 'Vite 构建工具入门与进阶' && late.active[0] === '全部'
    ? 'RACE SAFE' : '*** RACE BUG: stale tagged response overwrote cleared state ***')

  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
