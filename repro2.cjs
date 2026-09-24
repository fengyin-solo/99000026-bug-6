const { chromium } = require('playwright')

const LIB = '/tmp/chromelibs/lib/aarch64-linux-gnu:/tmp/chromelibs/usr/lib/aarch64-linux-gnu'

function makeChecks(page, requests) {
  return {
    async snap(label) {
      const s = await page.evaluate(() => {
        const title = document.querySelector('.page-title')?.childNodes[0]?.textContent.trim()
          || document.querySelector('.page-title')?.textContent.trim()
        const chips = [...document.querySelectorAll('.tag-list .el-tag')]
        const active = chips.filter(el =>
          el.classList.contains('el-tag--dark') && !el.classList.contains('el-tag--info')
        ).map(el => el.textContent.trim())
        const titles = [...document.querySelectorAll('.article-card .article-title')]
          .slice(0, 2).map(e => e.textContent.trim())
        const pager = document.querySelector('.el-pager .is-active')?.textContent.trim()
        const searchVal = document.querySelector('.navbar .search-input input')?.value
        const chipShown = !!document.querySelector('.search-tag')
        return { title, active, pager, searchVal, chipShown, titles }
      })
      s.url = new URL(page.url()).search
      s.lastReq = requests.at(-1) ? requests.at(-1).replace(/.*\/api/, '/api') : null
      console.log(`\n--- ${label} ---\n${JSON.stringify(s, null, 1)}`)
      return s
    }
  }
}

;(async () => {
  const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: LIB } })
  const page = await browser.newPage()
  const requests = []
  await page.route('**/api/articles**', async route => {
    requests.push(route.request().url())
    await new Promise(r => setTimeout(r, 150)) // small jitter window
    return route.continue()
  })
  const c = makeChecks(page, requests)

  // ===== Flow 1: browser back/forward with real push entries =====
  console.log('######## FLOW 1: 搜索 -> 点文章卡片上的标签(replace) -> 后退 -> 前进')
  await page.goto('http://localhost:5173/')
  await page.waitForSelector('.article-card')
  await page.fill('.navbar .search-input input', 'Node')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  await c.snap('1a search=Node (push entry)')
  // click a tag chip inside first article card
  const chip = page.locator('.article-card .article-tags .el-tag').first()
  const tagName = await chip.textContent()
  await chip.click()
  await page.waitForTimeout(500)
  await c.snap(`1b clicked card tag "${tagName.trim()}" (replace, keeps search)`)
  requests.length = 0
  await page.goBack()
  await page.waitForTimeout(500)
  const s1c = await c.snap('1c BROWSER BACK -> search only')
  console.log('CHECK 1c:',
    s1c.url === '?search=Node' ? 'urlOK' : 'URL-BAD',
    s1c.active.length === 1 && s1c.active[0] === '全部' ? 'hlOK' : 'HL-BAD(' + s1c.active + ')',
    s1c.title === '搜索结果' ? 'titleOK' : 'TITLE-BAD(' + s1c.title + ')',
    s1c.lastReq.includes('search=Node') && !s1c.lastReq.includes('tag=') ? 'reqOK' : 'REQ-BAD(' + s1c.lastReq + ')')
  requests.length = 0
  await page.goForward()
  await page.waitForTimeout(500)
  const s1d = await c.snap('1d BROWSER FORWARD -> tag+search')
  console.log('CHECK 1d:',
    s1d.url.includes('tag=') && s1d.url.includes('search=Node') ? 'urlOK' : 'URL-BAD',
    s1d.active[0] === tagName.trim() ? 'hlOK' : 'HL-BAD(' + s1d.active + ')',
    s1d.title === '搜索结果' ? 'titleOK' : 'TITLE-BAD(' + s1d.title + ')',
    s1d.lastReq.includes('tag=') && s1d.lastReq.includes('search=Node') ? 'reqOK' : 'REQ-BAD(' + s1d.lastReq + ')')

  // ===== Flow 2: 顶部清空条件 (navbar clear x) after back navigation =====
  console.log('\n######## FLOW 2: 标签 -> 搜索 -> 后退恢复标签 -> 点顶部导航栏清空按钮')
  await page.goto('http://localhost:5173/')
  await page.waitForSelector('.article-card')
  await page.locator('.tag-list .el-tag', { hasText: 'Vue' }).first().click()
  await page.waitForTimeout(400)
  await page.fill('.navbar .search-input input', 'Node')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  await c.snap('2a search pushed (tag dropped by navbar search)')
  requests.length = 0
  await page.goBack()
  await page.waitForTimeout(400)
  const s2b = await c.snap('2b BACK -> tag=Vue (navbar input still shows Node?)')
  // click the clear (x) icon of el-input
  const clearIcon = page.locator('.navbar .search-input .el-input__clear')
  const hasClearIcon = await clearIcon.count()
  console.log('clear icon visible:', hasClearIcon)
  if (hasClearIcon) {
    await clearIcon.click()
    await page.waitForTimeout(400)
    const s2c = await c.snap('2c clicked navbar CLEAR x')
    console.log('CHECK 2c:',
      s2c.url === '' ? 'urlOK' : 'URL-BAD(' + s2c.url + ')',
      s2c.searchVal === '' ? 'inputOK' : 'INPUT-BAD(' + s2c.searchVal + ')',
      s2c.active[0] === '全部' ? 'hlOK' : 'HL-BAD(' + s2c.active + ')',
      !s2c.lastReq?.includes('tag=') ? 'reqOK' : 'REQ-BAD(' + s2c.lastReq + ')')
  }

  // ===== Flow 2b: title search-chip close with tag active =====
  console.log('\n######## FLOW 2b: 搜索+标签 同时存在时, 关闭标题区搜索 chip')
  await page.goto('http://localhost:5173/')
  await page.waitForSelector('.article-card')
  await page.fill('.navbar .search-input input', 'Node')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  const chip2 = page.locator('.article-card .article-tags .el-tag').first()
  const tn = (await chip2.textContent()).trim()
  requests.length = 0
  await chip2.click()
  await page.waitForTimeout(400)
  await c.snap(`2b-a tag ${tn}+search combined`)
  requests.length = 0
  await page.locator('.search-tag .el-tag__close').click()
  await page.waitForTimeout(400)
  const s2b2 = await c.snap('2b-b closed search chip, tag must remain')
  console.log('CHECK 2b2:',
    s2b2.url === `?tag=${encodeURIComponent(tn)}` ? 'urlOK' : 'URL-BAD(' + s2b2.url + ')',
    s2b2.active[0] === tn ? 'hlOK' : 'HL-BAD(' + s2b2.active + ')',
    s2b2.title === `标签: ${tn}` ? 'titleOK' : 'TITLE-BAD(' + s2b2.title + ')',
    s2b2.chipShown === false ? 'chipGoneOK' : 'CHIP-BAD',
    s2b2.lastReq?.includes(`tag=${encodeURIComponent(tn)}`) && !s2b2.lastReq.includes('search=') ? 'reqOK' : 'REQ-BAD(' + s2b2.lastReq + ')')

  // ===== Flow 3: article detail back button =====
  console.log('\n######## FLOW 3: ?tag=Vue -> 文章详情 -> 返回列表')
  await page.goto('http://localhost:5173/?tag=Vue')
  await page.waitForSelector('.article-card')
  await page.waitForTimeout(300)
  // go to page 2 first if available
  const p2 = page.locator('.el-pager .number', { hasText: '2' })
  if (await p2.count()) { await p2.click(); await page.waitForTimeout(400) }
  const s3a = await c.snap('3a tag=Vue page 2 (URL should carry page after fix)')
  await page.locator('.article-card').first().click()
  await page.waitForSelector('.article-detail')
  await page.waitForTimeout(300)
  requests.length = 0
  await page.getByRole('button', { name: /返回列表/ }).click()
  await page.waitForTimeout(600)
  const s3c = await c.snap('3c back from detail')
  console.log('CHECK 3c:',
    s3c.url.includes('tag=Vue') ? 'urlOK' : 'URL-BAD(' + s3c.url + ')',
    s3c.active[0] === 'Vue' ? 'hlOK' : 'HL-BAD(' + s3c.active + ')',
    s3c.title === '标签: Vue' ? 'titleOK' : 'TITLE-BAD(' + s3c.title + ')',
    s3c.lastReq?.includes('tag=Vue') ? 'reqOK' : 'REQ-BAD(' + s3c.lastReq + ')',
    s3c.pager === (s3a.pager || '1') ? 'pageOK' : 'PAGE-BAD(was ' + s3a.pager + ' now ' + s3c.pager + ')')

  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
