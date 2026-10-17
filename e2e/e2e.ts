// End-to-end run against the local stand-in (PGlite + PostgREST) and `next dev` on :3100.
// Start everything with `bun run e2e` (see e2e/run.sh).
import fs from 'node:fs'
import { chromium, devices, type Browser, type Page, type Route } from 'playwright-core'
import assert from 'node:assert/strict'
import { unzipSync } from 'fflate'
const BASE = (process.env.E2E_BASE_URL || process.env.BASE || 'http://localhost:3100').replace(/\/+$/, '')
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rahasia-e2e'
const CSV = new URL('../public/contoh-soal.csv', import.meta.url).pathname
// question fragment → correct option, matching public/contoh-soal.csv
const KEY: [string, string][] = [
  ['KSR?', 'Korps Sukarela'],
  ['tidak sadar', 'Posisi pemulihan'],
  ['luka bakar', 'Benar'],
  ['Tourniquet', 'Salah'],
]
const answerFor = (text: string) => KEY.find(([q]) => text.includes(q))![1]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const log = (m: string) => console.log('✓', m)

async function admin(browser: Browser) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/admin`)
  assert.match(page.url(), /\/admin\/login/)
  await page.fill('input[name=password]', 'salah')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL(/error=1/)
  await page.getByText('Password salah.').waitFor()
  await page.fill('input[name=password]', ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL(`${BASE}/admin`)
  log('admin login rejects wrong password, accepts right one')
  return page
}

async function createSession(page: Page, title: string, kind: 'pre' | 'post', mode: 'total' | 'per_question', perQuestion = 45) {
  await page.goto(`${BASE}/admin`)
  await page.getByRole('button', { name: 'Buat sesi baru' }).click()
  await page.fill('input[name=title]', title)
  await page.selectOption('select[name=kind]', kind)
  await page.selectOption('select[name=timer_mode]', mode)
  // Only the chosen mode's time field is editable.
  const [used, unused] = mode === 'total' ? ['duration_min', 'per_question_sec'] : ['per_question_sec', 'duration_min']
  assert.ok(await page.locator(`input[name=${unused}]`).isDisabled())
  await page.fill(`input[name=${used}]`, mode === 'total' ? '10' : String(perQuestion))
  await page.getByRole('button', { name: 'Buat sesi', exact: true }).click()
  await page.waitForURL(/\/admin\/sessions\//)
  const code = (await page.locator('text=/kode [A-Z0-9]{6}/').innerText()).match(/kode ([A-Z0-9]{6})/)![1]
  await page.click('button:has-text("Soal")')
  await page.click('summary:has-text("Upload file soal")')
  await page.setInputFiles('input[name=file]', CSV)
  await page.click('text=Upload & ganti semua soal')
  await page.getByText('4 soal tersimpan').waitFor()
  await page.click('button:has-text("Kontrol")')
  await page.click('text=Buka sesi')
  await page.getByText('Lobi dibuka —').waitFor()
  assert.ok(await page.locator('img[alt^="QR http"]').isVisible())
  log(`session ${title} (${mode}, other mode's time field disabled) created, 4 questions uploaded, lobby opened, QR shown → ${code}`)
  return { code, url: page.url().split('?')[0] }
}

// "Mulai ujian" on the session page: everyone's questions appear START_DELAY_MS later.
async function startExam(page: Page, url: string) {
  await page.goto(url)
  page.once('dialog', (dlg) => dlg.accept())
  await page.getByRole('button', { name: 'Mulai ujian', exact: true }).click()
  await page.getByText('Soal muncul di HP peserta dalam').waitFor()
}
const STARTED = { timeout: 20_000 } // START_DELAY_MS + a lobby poll

// Joins; resolves once the exam page is showing (questions, or the lobby when `active` is false).
async function participant(browser: Browser, code: string, name: string, nim: string, active = true) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'] })
  const page = await ctx.newPage()
  const views: string[] = []
  page.on('response', async (r) => {
    if (r.url().includes('/api/attempts/')) views.push(await r.text().catch(() => ''))
  })
  await page.goto(`${BASE}/s/${code}`)
  await page.fill('input[name=name]', name)
  await page.fill('input[name=nim]', nim)
  await page.fill('input[name=prodi]', 'S1 TI')
  await page.click('text=Masuk ujian')
  await page.waitForURL(/\/exam\//)
  await (active ? page.getByText(/Pelanggaran 0 dari/) : page.getByText('Menunggu panitia memulai ujian')).waitFor()
  return { page, views }
}

async function pick(page: Page, text: string) {
  await page.locator('main [role=group] button', { hasText: new RegExp(`^(?:[A-ES]\\.?\\s?)?${text}$`) }).first().click()
}

const resolveChromium = () => {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) {
    if (fs.existsSync(p)) return p
  }
  return undefined
}
const chromiumPath = resolveChromium()
const browser = await chromium.launch(chromiumPath ? { executablePath: chromiumPath } : {})
try {
  const adminPage = await admin(browser)

  // --- total mode ---------------------------------------------------------
  const pre = await createSession(adminPage, 'Pre-test E2E', 'pre', 'total')

  // Share-screen view: the code and QR only, never the answer key the session page shows.
  const display = await adminPage.context().newPage()
  await display.goto(`${pre.url}/qr`)
  await display.getByText(pre.code, { exact: true }).waitFor()
  assert.ok(await display.locator('img[alt^="QR http"]').isVisible())
  assert.equal(await display.getByText('✓').count(), 0)
  await display.close()
  log('QR display page shows the code and QR without the answer key')

  // --- lobby -------------------------------------------------------------
  const a = await participant(browser, pre.code, 'Ani', '1001', false)
  assert.equal(await a.page.evaluate(() => document.fullscreenElement !== null), true)
  const attemptA = a.page.url().split('/exam/')[1]
  const early = await a.page.request.post(`${BASE}/api/attempts/${attemptA}/submit`, { data: {} })
  assert.equal(early.status(), 409)
  assert.ok(a.views.length > 0 && a.views.every((v) => v.includes('"status":"waiting"') && v.includes('"questions":[]')))
  log('participant enters fullscreen on joining and waits in the lobby; no questions sent, submitting is refused')
  await startExam(adminPage, pre.url)
  await a.page.getByText('Ujian dimulai dalam').waitFor()
  await a.page.getByText(/Pelanggaran 0 dari/).waitFor(STARTED)
  log('"Mulai ujian" shows a countdown on the waiting phone, then the questions appear without a reload')
  // Total mode shows one question at a time; walk through them with "Berikutnya".
  for (let n = 1; n <= 4; n++) {
    await a.page.getByText(`Soal ${n} dari 4`).waitFor()
    await pick(a.page, answerFor(await a.page.locator('main [data-question]').innerText()))
    if (n < 4) await a.page.getByRole('button', { name: 'Berikutnya' }).click()
  }
  // no pause: submit must queue behind the in-flight answers
  await a.page.click('text=Kumpulkan jawaban')
  await a.page.getByText('4 dari 4 soal terjawab').waitFor()
  await a.page.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
  await a.page.getByText('Jawaban terkirim').waitFor()
  await a.page.getByText('Selamat, kamu sudah selesai!').waitFor()
  assert.ok((await a.page.locator('.confetti').count()) > 0)
  assert.ok(a.views.length > 0 && a.views.every((v) => !v.includes('answer_index') && !v.includes('"score"')))
  log('total mode: answer all, confirm, submit, celebration shown; API never sent answer key or score')

  await a.page.goto(`${BASE}/s/${pre.code}`)
  await a.page.getByText('Lihat nilai ujianmu').waitFor()
  await a.page.getByText('Ujian ini sudah dikerjakan dari HP ini').waitFor()
  assert.equal(await a.page.getByRole('button', { name: 'Masuk ujian' }).count(), 0)
  log('a phone that finished the session can open its score but not start another attempt')

  // violations → auto-submit
  const b = await participant(browser, pre.code, '=HYPERLINK("http://x")', '1002')
  const deadline = (views: string[]) => JSON.parse(views.findLast((v) => v.includes('deadline_at'))!).deadline_at
  assert.equal(deadline(b.views), deadline(a.views))
  log('a latecomer gets the same end time as everyone (only the time left)')
  await pick(b.page, answerFor(await b.page.locator('main [data-question]').innerText())) // one right answer: 25
  for (let i = 1; i <= 2; i++) {
    await b.page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await b.page.locator('[data-violation-count]', { hasText: `pelanggaran ${i} dari 3` }).waitFor()
    await b.page.click('text=Saya mengerti, lanjutkan')
    await sleep(2100)
  }
  // leaving the tab: visibilitychange + blur together count once
  await b.page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('blur'))
  })
  await b.page.getByText('Jawaban terkirim').waitFor()
  await b.page.getByText('Ujian dikumpulkan otomatis').waitFor()
  assert.equal(await b.page.locator('.confetti').count(), 0)
  log('violations 1-2 show warning overlay, 3rd auto-submits (no celebration)')

  // reopen counts as violation
  const c = await participant(browser, pre.code, 'Cici', '1003')
  await c.page.reload()
  await c.page.locator('[data-violation-count]', { hasText: /pelanggaran [12] dari 3/i }).waitFor()
  await c.page.getByText('Layar ujian terkunci').or(c.page.getByText('Peringatan')).first().waitFor()
  log('reloading the exam counts as a "reopen" violation and locks the screen')
  // resume link on the join page
  await c.page.goto(`${BASE}/s/${pre.code}`)
  await c.page.getByText('Lanjutkan ujian').waitFor()
  log('join page offers "Lanjutkan ujian" for an unfinished attempt')

  const d = await participant(browser, pre.code, 'Dodi', '1004')
  const prevented = await d.page.evaluate(() =>
    ['contextmenu', 'copy', 'selectstart'].map((t) => {
      const ev = new Event(t, { cancelable: true, bubbles: true })
      document.querySelector('main')!.dispatchEvent(ev)
      return ev.defaultPrevented
    }),
  )
  assert.deepEqual(prevented, [true, true, true])
  const css = await d.page.evaluate(() => getComputedStyle(document.querySelector('.no-select')!).userSelect)
  assert.equal(css, 'none')
  log('exam page blocks context menu / copy / selection')

  const crafted = await d.page.request.post(`${BASE}/api/attempts/${d.page.url().split('/exam/')[1]}/violation`, { data: { type: '__proto__' } })
  assert.equal(crafted.status(), 400)
  log('a crafted violation type is rejected')
  // Bottom-edge swipe in fullscreen triggers violation & opaque lock
  const dodiState = await d.page.evaluate(() => ({
    fullscreen: document.fullscreenElement !== null,
    innerHeight: window.innerHeight,
    url: window.location.href,
  }))
  log(`Dodi state before swipe: ${JSON.stringify(dodiState)}`)
  await d.page.evaluate(() => {
    const h = window.innerHeight
    const t = (y: number) => new Touch({ identifier: 1, target: document.body, clientX: 200, clientY: y })
    document.body.dispatchEvent(new TouchEvent('touchstart', { touches: [t(h - 5)], changedTouches: [t(h - 5)], bubbles: true }))
    document.body.dispatchEvent(new TouchEvent('touchmove', { touches: [t(h - 60)], changedTouches: [t(h - 60)], bubbles: true }))
  })
  await d.page.locator('[data-violation-count]', { hasText: /pelanggaran 1 dari 3/i }).waitFor({ timeout: 10000 }).catch(async (e) => {
    const debugInfo = await d.page.evaluate(() => ({
      bodyText: document.body.innerText,
      alertCount: document.querySelectorAll('[role=alertdialog]').length,
      violationCountEl: document.querySelector('[data-violation-count]')?.textContent,
    }))
    log(`Debug info on failure: ${JSON.stringify(debugInfo)}`)
    throw e
  })
  const alertBg = await d.page.evaluate(() => getComputedStyle(document.querySelector('[role=alertdialog]')!).backgroundColor)
  assert.equal(alertBg, 'rgb(11, 21, 39)')
  log('swiping in from the screen edge in fullscreen counts as a violation and locks the screen opaquely')

  await d.page.click('text=Saya mengerti, lanjutkan')
  await sleep(2100)
  // Assert that a tap in the edge strip is free (no violation / lock)
  await d.page.evaluate(() => {
    const h = window.innerHeight
    const t = (y: number) => new Touch({ identifier: 1, target: document.body, clientX: 200, clientY: y })
    document.body.dispatchEvent(new TouchEvent('touchstart', { touches: [t(h - 5)], changedTouches: [t(h - 5)], bubbles: true }))
    document.body.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(h - 5)], bubbles: true }))
  })
  await sleep(500)
  assert.equal(await d.page.locator('[role=alertdialog]').count(), 0)

  // 3-finger touch
  await d.page.evaluate(() => {
    const t = (id: number) => new Touch({ identifier: id, target: document.body, clientX: 100 * id, clientY: 200 })
    document.body.dispatchEvent(new TouchEvent('touchstart', { touches: [t(1), t(2), t(3)], changedTouches: [t(1), t(2), t(3)], bubbles: true }))
  })
  await d.page.locator('[data-violation-count]', { hasText: 'pelanggaran 2 dari 3' }).waitFor()
  log('a 3-finger touch counts as a violation')


  await d.page.click('text=Saya mengerti, lanjutkan')
  await sleep(2100)

  // In-app browsers (Instagram, LINE, …) refuse fullscreen; the exam must still be usable, not locked.
  const inApp = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage()
  await inApp.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('Fullscreen is not allowed'))
  })
  await inApp.goto(`${BASE}/s/${pre.code}`)
  assert.equal(await inApp.locator('.old-browser-note').isVisible(), false)
  await inApp.fill('input[name=name]', 'Eka')
  await inApp.fill('input[name=nim]', '1006')
  await inApp.fill('input[name=prodi]', 'S1 TI')
  await inApp.click('text=Masuk ujian')
  await inApp.getByText(/Pelanggaran 0 dari/).waitFor()
  assert.equal(await inApp.getByText('Layar ujian terkunci').count(), 0)
  await inApp.click('text=Daftar soal')
  await inApp.click('text=Kumpulkan jawaban')
  await inApp.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
  await inApp.getByText('Selamat, kamu sudah selesai!').waitFor()
  log('a browser that refuses fullscreen can still take the exam; no outdated-browser note on modern browsers')

  // --- admin results ------------------------------------------------------
  await adminPage.goto(pre.url)
  await adminPage.click('button:has-text("Peserta")')
  const row = (name: string) => adminPage.locator('tbody tr', { hasText: name })
  assert.match(await row('Ani').innerText(), /1001\s+S1 TI\s+100\s+0\s+Selesai/)
  assert.match(await row('HYPERLINK').innerText(), /1002\s+S1 TI\s+25\s+3\s+Auto-submit \(pelanggaran\)/)
  await row('HYPERLINK').locator('summary').click()
  assert.match(await row('HYPERLINK').innerText(), /hilang fokus/)
  assert.match(await row('Cici').innerText(), /Mengerjakan/)
  await row('Dodi').locator('summary').click()
  assert.match(await row('Dodi').innerText(), /geser tepi layar/)
  log('admin results show score, violation count/log and status')

  const csv = await (await adminPage.request.get(`${pre.url}/export?format=csv`)).text()
  assert.match(csv, /Ani,1001,S1 TI,100,0,selesai/)
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/x""\)",1002,S1 TI,25,3/)
  const anon = await (await browser.newContext()).request.get(`${pre.url}/export`)
  assert.equal(anon.status(), 401)
  log('CSV export works, escapes formula names, requires admin')

  // question editing is locked while participants exist; reset one participant
  await adminPage.click('button:has-text("Soal")')
  await adminPage.getByText(/^Soal terkunci karena sudah ada peserta atau ujian sudah dimulai/).waitFor()
  assert.equal(await adminPage.locator('input[type=file], summary:has-text("Tambah soal")').count(), 0)
  await adminPage.click('button:has-text("Peserta")')
  adminPage.once('dialog', (dlg) => dlg.accept())
  await row('Cici').getByText('Reset').click()
  await adminPage.getByText('Peserta direset').waitFor()
  assert.equal(await row('Cici').count(), 0)
  log('question editing locked while attempts exist; single reset works')

  await adminPage.click('button:has-text("Pengaturan")')
  await adminPage.fill('input[name=duration_min]', '20')
  await adminPage.getByRole('button', { name: 'Simpan pengaturan', exact: true }).click()
  await adminPage.getByText('timer terkunci karena sudah ada peserta atau ujian sudah dimulai').waitFor()
  log('timer settings are locked while attempts exist')

  // --- per-question mode ----------------------------------------------------
  const post = await createSession(adminPage, 'Post-test E2E', 'post', 'per_question', 5)
  const p = await participant(browser, post.code, 'Ani', '1001', false)
  await startExam(adminPage, post.url)
  await p.page.getByText('Soal 1 dari 4').waitFor(STARTED)
  assert.ok(await p.page.getByText('Jawab & lanjut').isDisabled())
  const firstText = await p.page.locator('main [data-question]').innerText()
  await pick(p.page, answerFor(firstText))
  await p.page.click('text=Jawab & lanjut')
  await p.page.getByText('Soal 2 dari 4').waitFor()
  log('per-question: answer advances to the next question')
  await p.page.getByText('Soal 3 dari 4').waitFor({ timeout: 12_000 })
  log('per-question: unanswered question is skipped when its timer runs out')
  for (const n of [3, 4]) {
    const text = await p.page.locator('main [data-question]').innerText()
    await pick(p.page, answerFor(text))
    await p.page.click(n === 4 ? 'text=Jawab & selesai' : 'text=Jawab & lanjut')
    if (n === 3) await p.page.getByText('Soal 4 dari 4').waitFor()
  }
  await p.page.getByText('Jawaban terkirim').waitFor()
  await p.page.getByText('Nilai semua peserta muncul serentak dalam').waitFor()
  log('per-question: last answer finishes the exam; score is withheld while the session is open, with a countdown')

  await adminPage.goto(post.url)
  await adminPage.click('button:has-text("Peserta")')
  assert.match(await row('Ani').innerText(), /1001\s+S1 TI\s+75\s+0\s+Selesai/)
  log('per-question score 75 (skipped question counted wrong)')

  // --- compare --------------------------------------------------------------
  const preId = pre.url.split('/').pop()
  const postId = post.url.split('/').pop()
  await adminPage.goto(`${BASE}/admin/compare?pre=${preId}&post=${postId}`)
  assert.match(await adminPage.locator('tbody tr', { hasText: 'Ani' }).innerText(), /1001\s+100\s+75\s+-25/)
  log('compare page joins pre/post by NIM with delta')
  // --- rekap -----------------------------------------------------------------
  await adminPage.goto(`${BASE}/admin/rekap`)
  await adminPage.locator(`input[name="s"][value="${preId}"]`).check()
  await adminPage.locator(`input[name="s"][value="${postId}"]`).check()
  await adminPage.getByRole('button', { name: 'Tampilkan rekap' }).click()
  await adminPage.waitForURL(/\/admin\/rekap\?.*s=.*s=/)
  assert.match(
    await adminPage.locator('tbody tr', { hasText: 'Ani' }).innerText(),
    /1001\s+S1 TI\s+100\s+75\s+2\/2\s+87\.5/,
  )
  const recapCsv = await (
    await adminPage.request.get(`${BASE}/admin/rekap/export?s=${preId}&s=${postId}&format=csv`)
  ).text()
  assert.match(recapCsv, /Ani,1001,S1 TI,100,75,2,87\.5/)
  const anonRecapRes = await (await browser.newContext()).request.get(
    `${BASE}/admin/rekap/export?s=${preId}&s=${postId}&format=csv`,
  )
  assert.equal(anonRecapRes.status(), 401)
  log('rekap page lists many sessions per NIM; CSV export requires admin')

  const raporHref = await adminPage.locator('tbody tr', { hasText: 'Ani' }).getByRole('link', { name: 'Unduh' }).getAttribute('href')
  const rapor = await adminPage.context().newPage()
  await rapor.goto(BASE + raporHref)
  const raporText = await rapor.locator('article').innerText()
  assert.match(raporText, /Rapor Peserta[\s\S]*Ani[\s\S]*1001[\s\S]*S1 TI/)
  assert.match(raporText, /Rata-rata nilai\s+87\.5\s+2 dari 2 ujian diikuti/)
  assert.match(await rapor.title(), /Rapor 1001 Ani/)
  assert.ok((await rapor.pdf()).length > 1000) // what "Simpan sebagai PDF" produces
  await rapor.close()
  assert.equal((await (await browser.newContext()).request.get(BASE + raporHref, { maxRedirects: 0 })).status() >= 300, true)
  log('rapor per NIM opens from the recap, prints to PDF, and requires admin')
  // bulk rapor ZIP
  const zipRes = await adminPage.request.get(`${BASE}/admin/rekap/rapor/zip?s=${preId}&s=${postId}`)
  assert.equal(zipRes.status(), 200)
  assert.equal(zipRes.headers()['content-type'], 'application/zip')
  const zipBuf = await zipRes.body()
  const unzipped = unzipSync(new Uint8Array(zipBuf))
  const entryNames = Object.keys(unzipped)
  assert.ok(entryNames.includes('Rapor 1001 Ani.pdf'))
  assert.equal(entryNames.length, 4) // Ani (1001), HYPERLINK (1002), Cici (1003), Dodi (1004)
  for (const name of entryNames) {
    const pdfHead = Buffer.from(unzipped[name].subarray(0, 4)).toString('ascii')
    assert.equal(pdfHead, '%PDF')
  }
  const anonZipRes = await (await browser.newContext()).request.get(`${BASE}/admin/rekap/rapor/zip?s=${preId}&s=${postId}`)
  assert.equal(anonZipRes.status(), 401)
  log('bulk rapor ZIP has one PDF per NIM and requires admin')


  // --- automatic close ---------------------------------------------------------------
  // Starting began a 4 × 5 s clock: the session closes by itself and, with nobody working,
  // the waiting participant's score appears without a reload.
  await adminPage.goto(post.url)
  await adminPage.getByText('Ujian berakhir dalam').waitFor()
  await adminPage.getByText('Sesi ditutup otomatis').waitFor({ timeout: 30_000 }) // auto-refresh, no reload
  await p.page.getByText('Nilaimu').waitFor({ timeout: 35_000 })
  const shut = await (await browser.newContext()).newPage()
  await shut.goto(`${BASE}/s/${post.code}`)
  await shut.getByText('Sesi ini belum dibuka atau sudah ditutup.').waitFor()
  log('session closes on its own after its duration; the score then appears without a reload')
  await adminPage.getByRole('button', { name: 'Buka sesi', exact: true }).click()
  await adminPage.getByText('Lobi dibuka —').waitFor()
  log('reopening a session whose exam is over opens a fresh lobby')

  // --- closed session and score release -------------------------------------------
  // Budi is still working when the committee closes the session; closing force-submits all active
  // participants immediately and releases scores.
  const late = await participant(browser, post.code, 'Budi', '1004', false)
  await startExam(adminPage, post.url)
  await late.page.getByText('Soal 1 dari 4').waitFor(STARTED)
  await adminPage.goto(post.url)
  adminPage.once('dialog', (dlg) => dlg.accept())
  await adminPage.getByRole('button', { name: 'Tutup sesi', exact: true }).click()
  await adminPage.getByText('Sesi ditutup —').waitFor()
  log('closing session force-submits working participants and releases scores immediately')
  // No reloads from here: both pages must pick the score up on their own.
  const shown = async (page: Page) => {
    await page.getByText('Nilaimu').waitFor({ timeout: 35_000 })
    return Date.now()
  }
  const [aniAt, budiAt] = await Promise.all([shown(p.page), shown(late.page)])
  assert.ok(Math.abs(aniAt - budiAt) < 4000, `scores appeared ${Math.abs(aniAt - budiAt)} ms apart`)
  assert.equal(await p.page.locator('[data-score]').innerText(), '75')
  await p.page.getByText(/Kerja bagus, Ani!/).waitFor()
  assert.ok((await p.page.locator('.confetti').count()) > 0)
  await adminPage.getByText('Nilai sudah terlihat oleh peserta').waitFor({ timeout: 15_000 }) // auto-refresh, no reload
  await adminPage.click('button:has-text("Peserta")')
  await adminPage.getByRole('cell', { name: 'Waktu habis' }).waitFor({ timeout: 10_000 })
  assert.ok(await adminPage.getByRole('cell', { name: 'Waktu habis' }).isVisible())
  log('every participant sees their score immediately after session is closed; admin page updates itself')

  const closed = await (await browser.newContext()).newPage()
  await closed.goto(`${BASE}/s/${post.code}`)
  await closed.getByText('Sesi ini belum dibuka atau sudah ditutup.').waitFor()
  assert.equal(await closed.getByText('Lihat nilai ujianmu').count(), 0)
  const api = await closed.request.post(`${BASE}/api/attempts`, { data: { code: post.code, name: 'X', nim: '9', prodi: 'S1 TI' } })
  assert.equal(api.status(), 403)
  log('closed session refuses new participants (page and API)')

  await p.page.goto(`${BASE}/s/${post.code}`)
  await p.page.click('text=Lihat nilai ujianmu')
  await p.page.getByText('Nilaimu').waitFor()
  log('the join page links a finished participant back to their score')

  // --- manual questions ----------------------------------------------------------
  await adminPage.goto(`${BASE}/admin`)
  await adminPage.getByRole('button', { name: 'Buat sesi baru' }).click()
  await adminPage.fill('input[name=title]', 'Manual E2E')
  await adminPage.getByRole('button', { name: 'Buat sesi', exact: true }).click()
  await adminPage.waitForURL(/\/admin\/sessions\//)
  await adminPage.click('button:has-text("Soal")')
  const addForm = adminPage.locator('details:has(summary:has-text("Tambah soal manual")) form')
  await addForm.locator('textarea[name=question]').fill('Warna bendera PMI?')
  await addForm.locator('input[name=a]').fill('Merah putih')
  await addForm.locator('input[name=b]').fill('Biru')
  await addForm.locator('input[name=c]').fill('Hijau')
  await addForm.locator('select[name=answer]').selectOption('C')
  // A 2×2 PNG; the form re-encodes it to JPEG in the browser before upload.
  await addForm.locator('input[name=image]').setInputFiles({
    name: 'luka.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGP4z8DwnwGM/zMwAAAf7gP9NRsAMwAAAABJRU5ErkJggg==', 'base64'),
  })
  await addForm.locator('img[alt="Pratinjau gambar soal"]').waitFor()
  await addForm.locator('button').click()
  await adminPage.getByText('Soal ditambahkan').waitFor()
  await adminPage.click('summary:has-text("Tambah soal manual")')
  await addForm.locator('select[name=type]').selectOption('tf')
  assert.equal(await addForm.locator('input[name=a]').count(), 0)
  await addForm.locator('textarea[name=question]').fill('PMI berdiri tahun 1945.')
  await addForm.locator('select[name=answer]').selectOption('B')
  await addForm.locator('button').click()
  await adminPage.getByText('Soal ditambahkan').waitFor()
  await adminPage.locator('h2', { hasText: 'Soal (2)' }).waitFor()
  assert.match(await adminPage.locator('ol > li').first().innerText(), /C\. Hijau ✓/)
  assert.match(await adminPage.locator('ol > li').nth(1).innerText(), /Benar ✓/)
  log('manual form adds multiple-choice and true/false questions with the right key')

  const img = adminPage.locator('ol > li').first().locator('img[alt="Gambar soal 1"]')
  await img.waitFor()
  assert.ok(await img.evaluate((el: HTMLImageElement) => el.decode().then(() => el.naturalWidth === 2)))
  const imgRes = await (await browser.newContext()).request.get(BASE + (await img.getAttribute('src')))
  assert.equal(imgRes.headers()['content-type'], 'image/jpeg')
  log('a question can carry an image, shrunk to JPEG in the browser and served to anyone with the link')

  const first = adminPage.locator('ol > li').first()
  await first.locator('summary:has-text("Edit")').click()
  await first.locator('input[name=a]').fill('Merah')
  await first.locator('select[name=answer]').selectOption('A')
  await first.getByRole('button', { name: 'Simpan soal', exact: true }).click()
  await adminPage.getByText('Soal diperbarui').waitFor()
  assert.match(await adminPage.locator('ol > li').first().innerText(), /A\. Merah ✓/)
  adminPage.once('dialog', (dlg) => dlg.accept())
  await adminPage.locator('ol > li').nth(1).getByText('Hapus').click()
  await adminPage.getByText('Soal dihapus').waitFor()
  await adminPage.click('button:has-text("Soal")')
  await adminPage.locator('h2', { hasText: 'Soal (1)' }).waitFor()
  log('manual edit changes the answer key; delete removes a question')

  await adminPage.click('button:has-text("Soal")')
  await adminPage.click('summary:has-text("Upload file soal")')
  await adminPage.setInputFiles('input[name=file]', { name: 'soal.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK\x03\x04 not really a zip') })
  adminPage.once('dialog', (dlg) => dlg.accept())
  await adminPage.click('text=Upload & ganti semua soal')
  await adminPage.getByText(/^Upload gagal/).waitFor()
  await adminPage.click('button:has-text("Soal")')
  await adminPage.locator('h2', { hasText: 'Soal (1)' }).waitFor()
  log('a broken Excel file is rejected with a message and keeps existing questions')

  // --- theme toggle --------------------------------------------------------------
  const theme = () => adminPage.evaluate(() => document.documentElement.dataset.theme ?? 'system')
  const surface = () => adminPage.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await adminPage.emulateMedia({ colorScheme: 'light' })
  const lightBg = await surface()
  const toggle = adminPage.getByRole('button', { name: /^Tema:/ })
  await toggle.click() // Terang → Gelap (1 click switches to dark)
  assert.equal(await theme(), 'dark')
  assert.notEqual(await surface(), lightBg)
  await adminPage.reload()
  assert.equal(await theme(), 'dark')
  assert.notEqual(await surface(), lightBg)
  await adminPage.getByRole('button', { name: /^Tema:/ }).click() // Gelap → Terang
  assert.equal(await theme(), 'light')
  assert.equal(await surface(), lightBg)
  log('theme toggle switches to dark, survives reload, and returns to light')

  // --- session date + delete ----------------------------------------------------
  await adminPage.goto(`${BASE}/admin`)
  await adminPage.getByRole('button', { name: 'Buat sesi baru' }).click()
  await adminPage.fill('input[name=title]', 'Sesi Hapus E2E')
  await adminPage.fill('input[name=held_on]', '2026-10-05')
  await adminPage.getByRole('button', { name: 'Buat sesi', exact: true }).click()
  await adminPage.waitForURL(/\/admin\/sessions\//)
  await adminPage.getByText('5 Okt 2026', { exact: true }).waitFor()
  await adminPage.click('button:has-text("Pengaturan")')
  adminPage.once('dialog', (d) => d.accept())
  await adminPage.getByRole('button', { name: 'Hapus sesi', exact: true }).click()
  await adminPage.waitForURL(`${BASE}/admin`)
  await adminPage.getByText('Sesi Hapus E2E').waitFor({ state: 'detached' }) // URL changes before the new list renders
  assert.ok(await adminPage.getByText('Pre-test E2E').isVisible())
  log('session date is saved and shown; deleting a session removes it from the list')

  // --- pending feedback ------------------------------------------------------------
  // Slow the server down so the delayed spinner has time to appear.
  const slow = (ms: number) => async (route: Route) => {
    await sleep(ms)
    await route.continue().catch(() => {})
  }
  const spinner = (page: Page) => page.locator('button[aria-busy="true"] svg.animate-spin')

  const joiner = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage()
  await joiner.route('**/api/attempts', slow(1500))
  await joiner.goto(`${BASE}/s/${pre.code}`)
  await joiner.fill('input[name=name]', 'Dodi')
  await joiner.fill('input[name=nim]', '1005')
  await joiner.fill('input[name=prodi]', 'S1 TI')
  await joiner.click('text=Masuk ujian')
  await spinner(joiner).waitFor({ state: 'visible' })
  assert.ok(await joiner.locator('button[aria-busy="true"]').isDisabled())
  await joiner.waitForURL(/\/exam\//)
  log('participant start button shows a spinner and is disabled while the request is slow')

  await adminPage.goto(`${BASE}/admin`)
  await adminPage.route(`${BASE}/admin`, (route) => (route.request().method() === 'POST' ? slow(1500)(route) : route.continue()))
  await adminPage.getByRole('button', { name: 'Keluar', exact: true }).click()
  await spinner(adminPage).waitFor({ state: 'visible' })
  await adminPage.waitForURL(/\/admin\/login/)
  log('admin server-action button shows a spinner while the action is slow')

  console.log('\nALL E2E CHECKS PASSED')
} catch (e) {
  // Leave evidence for debugging: a screenshot of every open page.
  let n = 0
  for (const ctx of browser.contexts()) for (const page of ctx.pages()) await page.screenshot({ path: new URL(`.bin/fail-${n++}.png`, import.meta.url).pathname }).catch(() => {})
  throw e
} finally {
  await browser.close()
}
