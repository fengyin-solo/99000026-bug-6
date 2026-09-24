const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const errors = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

  const log = (...args) => console.log(...args)
  const snap = async (label) => {
    const state = await page.evaluate(() => {
      const title = document.querySelector('.page-title')?.textContent.trim()
      const active = [...document.querySelectorAll('.tag-list .el-tag')]
        .filter(el => el.classList.contains('el-tag--dark') && !el.classList.contains('el-tag--info'))
        .map(el => el.textContent.trim())
      const cardTitles = [...document.querySelectorAll('.article-title')].slice(0, 3).map(e => e.textContent.trim())
      const pagerActive = document.querySelector('.el-pager .is-active')?.textContent.trim()
      return { url: location.href, title, activeTags: active, cardTitles, pagerActive }
    })
    log(`\n=== ${label} ===`)
    log(JSON.stringify(state, null, 1))
    return state
  }

  // 0. home
  await page.goto('http://localhost:5173/')
  await page.waitForSelector('.article-card')
  await snap('initial home')

  // 1. click sidebar tag "Vue"
  await page.locator('.tag-list .el-tag', { hasText: 'Vue' }).first().click()
  await page.waitForTimeout(600)
  await snap('after clicking tag Vue')

  // record the XHR params on next list request
  let lastQuery = null
  page.on('request', req => {
    if (req.url().includes('/api/articles')) lastQuery = req.url()
  })

  // ---- Entry A: browser back then forward ----
  await page.goBack()
  await page.waitForTimeout(600)
  await snap('A1: browser BACK from ?tag=Vue')
  await page.goForward()
  await page.waitForTimeout(600)
  const a2 = await snap('A2: browser FORWARD back to ?tag=Vue')
  log('last articles request after forward:', lastQuery)
  log('A SYNC?', a2.url.includes('tag=Vue') && a2.activeTags.includes('Vue') && a2.title.includes('Vue') && (lastQuery||'').includes('tag=Vue'))

  // ---- Entry B: clear conditions (navbar clear + browser-back-like clearing) ----
  // simulate "顶部清空条件": navbar search clear path uses router.push({query:{}});
  // here tag is set, and user clicks 全部 (clear tag)
  lastQuery = null
  await page.locator('.tag-list .el-tag', { hasText: '全部' }).click()
  await page.waitForTimeout(600)
  const b = await snap('B: click 全部 (clear tag condition)')
  log('last articles request after clear:', lastQuery)
  log('B SYNC?', !b.url.includes('tag=') && b.activeTags.includes('全部') && b.title === '最新文章' && !(lastQuery||'').includes('tag='))

  // set tag + page 2, then navbar-style clear with query {} (simulate via history)
  await page.locator('.tag-list .el-tag', { hasText: 'JavaScript' }).first().click()
  await page.waitForTimeout(600)
  // go to page 2 via pager if present
  const pager2 = page.locator('.el-pager .number', { hasText: '2' })
  if (await pager2.count()) { await pager2.click(); await page.waitForTimeout(600) }
  await snap('C0: tag JavaScript + page 2')
  // navbar clear: push query {} (as handleClear does)
  lastQuery = null
  await page.evaluate(() => history.pushState({}, '', '/'))
  await page.waitForTimeout(600)
  // pushState alone does not trigger vue router; dispatch popstate like browser back does
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')))
  await page.waitForTimeout(600)
  const c = await snap('C: popstate to / (simulating back / 顶部清空)')
  log('last articles request:', lastQuery)
  log('C SYNC?', !c.url.includes('tag='))

  // ---- Entry D: article detail back ----
  await page.goto('http://localhost:5173/?tag=Vue')
  await page.waitForTimeout(600)
  await page.locator('.article-card').first().click()
  await page.waitForSelector('.article-detail')
  await snap('D0: article detail page')
  await page.getByRole('button', { name: /返回列表/ }).click()
  await page.waitForTimeout(800)
  const d = await snap('D1: after 返回列表 button')
  log('D SYNC?', d.url.includes('tag=Vue') && d.activeTags.includes('Vue') && d.title.includes('Vue'))

  log('\nconsole errors:', errors)
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
