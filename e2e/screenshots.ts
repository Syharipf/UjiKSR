import { chromium } from 'playwright-core'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = 'http://localhost:3100'
const CSV = new URL('../public/contoh-soal.csv', import.meta.url).pathname
const XLSX = new URL('../public/contoh-soal.xlsx', import.meta.url).pathname
const OUT_DIR = path.resolve(import.meta.dirname, '../docs/img')

function convertToWebp(pngPath: string, webpPath: string, width?: number, height?: number) {
  const resize = width && height ? `-resize ${width}x${height}\\!` : ''
  execSync(`magick "${pngPath}" ${resize} -quality 92 "${webpPath}"`)
  fs.unlinkSync(pngPath)
  console.log('✓ Saved', path.basename(webpPath))
}

// Question keyword -> answer string from contoh-soal.csv
const KEY: [string, string][] = [
  ['KSR?', 'Korps Sukarela'],
  ['tidak sadar', 'Posisi pemulihan'],
  ['luka bakar', 'Benar'],
  ['Tourniquet', 'Salah'],
]

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium' })

  // 1. Admin Login (1280x800)
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await page.goto(`${BASE}/admin/login`)
    const tmp = path.join(OUT_DIR, 'admin-login.png')
    await page.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'admin-login.webp'), 1280, 800)
    await page.close()
  }

  // Admin login context
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const adminPage = await adminCtx.newPage()
  await adminPage.goto(`${BASE}/admin/login`)
  await adminPage.fill('input[name=password]', 'rahasia-e2e')
  await adminPage.getByRole('button', { name: 'Masuk' }).click()
  await adminPage.waitForURL(`${BASE}/admin`)

  // 7. Phone Landing (600x1298)
  {
    const phone = await browser.newPage({ viewport: { width: 600, height: 1298 } })
    await phone.goto(`${BASE}/`)
    const tmp = path.join(OUT_DIR, 'phone-landing.png')
    await phone.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-landing.webp'), 600, 1298)
    await phone.close()
  }

  // Create Pre-test session
  await adminPage.getByRole('button', { name: 'Buat sesi baru' }).click()
  await adminPage.fill('input[name=title]', 'Pre-test Diklat Dasar KSR 2026')
  await adminPage.fill('input[name=held_on]', '2026-10-15')
  await adminPage.selectOption('select[name=kind]', 'pre')
  await adminPage.selectOption('select[name=timer_mode]', 'total')
  await adminPage.fill('input[name=duration_min]', '15')
  await adminPage.getByRole('button', { name: 'Buat sesi' }).click()
  await adminPage.waitForURL(/\/admin\/sessions\//)
  const preUrl = adminPage.url().split('?')[0]
  const preId = preUrl.split('/admin/sessions/')[1]
  const preCode = (await adminPage.locator('text=/kode [A-Z0-9]{6}/').innerText()).match(/kode ([A-Z0-9]{6})/)![1]

  // Upload questions to Pre-test
  await adminPage.click('summary:has-text("Upload file soal")')
  await adminPage.setInputFiles('input[type=file]', CSV)
  await adminPage.click('text=Upload & ganti semua soal')
  await adminPage.getByText('4 soal tersimpan').waitFor()

  // 4. Admin Add Question element screenshot (Filled form!)
  {
    const details = adminPage.locator('details:has-text("Tambah soal manual")').first()
    await details.evaluate((el: HTMLDetailsElement) => { el.open = true })
    await sleep(200)
    await details.locator('textarea[name=question]').fill('Apa prinsip dasar Gerakan Palang Merah dan Bulan Sabit Merah yang pertama?')
    await details.locator('input[name=a]').fill('Kemanusiaan')
    await details.locator('input[name=b]').fill('Kesamaan')
    await details.locator('input[name=c]').fill('Kenetralan')
    await details.locator('input[name=d]').fill('Kemandirian')
    await details.locator('select[name=answer]').selectOption('A')
    const tmp = path.join(OUT_DIR, 'admin-add-question.png')
    await details.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'admin-add-question.webp'))
    await details.evaluate((el: HTMLDetailsElement) => { el.open = false })
  }

  // 5. Admin Upload CSV element screenshot (With file selected!)
  {
    const uploadDetails = adminPage.locator('details:has-text("Upload file soal")').first()
    await uploadDetails.evaluate((el: HTMLDetailsElement) => { el.open = true })
    await uploadDetails.locator('input[type=file]').setInputFiles(XLSX)
    await sleep(200)
    const tmp = path.join(OUT_DIR, 'admin-upload-csv.png')
    await uploadDetails.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'admin-upload-csv.webp'))
    await uploadDetails.evaluate((el: HTMLDetailsElement) => { el.open = false })
  }

  // 6. Admin QR Display (1280x720)
  {
    const qrPage = await adminCtx.newPage()
    await qrPage.setViewportSize({ width: 1280, height: 720 })
    await qrPage.goto(`${preUrl}/qr`)
    await qrPage.locator('canvas, svg, img[alt*="QR"]').first().waitFor()
    const tmp = path.join(OUT_DIR, 'admin-qr-display.png')
    await qrPage.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'admin-qr-display.webp'), 1280, 720)
    await qrPage.close()
  }

  // Open Pre-test session
  await adminPage.goto(preUrl)
  await adminPage.click('text=Buka sesi')
  await adminPage.getByText('Lobi dibuka —').waitFor()

  // 8. Phone Join (600x1298)
  {
    const phone = await browser.newPage({ viewport: { width: 600, height: 1298 } })
    await phone.goto(`${BASE}/s/${preCode}`)
    await phone.fill('input[name=name]', 'Ahmad Dahlan')
    await phone.fill('input[name=nim]', '120222001')
    await phone.fill('input[name=prodi]', 'S1 Sistem Informasi')
    const tmp = path.join(OUT_DIR, 'phone-join.png')
    await phone.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-join.webp'), 600, 1298)
    await phone.close()
  }

  // Join participants:
  // Participant 1: Ahmad Dahlan (100% score)
  const phoneAhmad = await browser.newPage({ viewport: { width: 600, height: 1298 } })
  await phoneAhmad.goto(`${BASE}/s/${preCode}`)
  await phoneAhmad.fill('input[name=name]', 'Ahmad Dahlan')
  await phoneAhmad.fill('input[name=nim]', '120222001')
  await phoneAhmad.fill('input[name=prodi]', 'S1 Sistem Informasi')
  await phoneAhmad.click('text=Masuk ujian')
  await phoneAhmad.waitForURL(/\/exam\//)

  // Participant 2: Budi Santoso (75% score)
  const phoneBudi = await browser.newPage({ viewport: { width: 600, height: 1298 } })
  await phoneBudi.goto(`${BASE}/s/${preCode}`)
  await phoneBudi.fill('input[name=name]', 'Budi Santoso')
  await phoneBudi.fill('input[name=nim]', '120222002')
  await phoneBudi.fill('input[name=prodi]', 'S1 Teknik Informatika')
  await phoneBudi.click('text=Masuk ujian')
  await phoneBudi.waitForURL(/\/exam\//)

  // Participant 3: Citra Lestari (100% score)
  const phoneCitra = await browser.newPage({ viewport: { width: 600, height: 1298 } })
  await phoneCitra.goto(`${BASE}/s/${preCode}`)
  await phoneCitra.fill('input[name=name]', 'Citra Lestari')
  await phoneCitra.fill('input[name=nim]', '120222003')
  await phoneCitra.fill('input[name=prodi]', 'S1 Desain Komunikasi Visual')
  await phoneCitra.click('text=Masuk ujian')
  await phoneCitra.waitForURL(/\/exam\//)

  // Participant 4: Dodi Pratama (Auto-submit with 3 violations)
  const phoneDodi = await browser.newPage({ viewport: { width: 600, height: 1298 } })
  await phoneDodi.goto(`${BASE}/s/${preCode}`)
  await phoneDodi.fill('input[name=name]', 'Dodi Pratama')
  await phoneDodi.fill('input[name=nim]', '120222004')
  await phoneDodi.fill('input[name=prodi]', 'S1 Teknik Telekomunikasi')
  await phoneDodi.click('text=Masuk ujian')
  await phoneDodi.waitForURL(/\/exam\//)

  // Start exam from admin
  await adminPage.goto(preUrl)
  adminPage.once('dialog', (d) => d.accept())
  await adminPage.getByRole('button', { name: 'Mulai ujian' }).click()
  await adminPage.getByText('Soal muncul di HP peserta dalam').waitFor()
  await phoneAhmad.getByText(/Pelanggaran 0 dari/).waitFor({ timeout: 15_000 })
  await phoneBudi.getByText(/Pelanggaran 0 dari/).waitFor({ timeout: 15_000 })
  await phoneCitra.getByText(/Pelanggaran 0 dari/).waitFor({ timeout: 15_000 })
  await phoneDodi.getByText(/Pelanggaran 0 dari/).waitFor({ timeout: 15_000 })

  // 9. Phone Exam Light (600x1298) - with an option selected!
  {
    // Click option B ("Posisi pemulihan") on question 1
    const optB = phoneAhmad.locator('main [role=group] button', { hasText: 'Posisi pemulihan' }).first()
    if (await optB.count()) await optB.click()
    else await phoneAhmad.locator('main [role=group] button').nth(1).click()
    await sleep(300)

    const tmp = path.join(OUT_DIR, 'phone-exam.png')
    await phoneAhmad.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-exam.webp'), 600, 1298)
  }

  // 10. Phone Exam Dark (600x1298)
  {
    await phoneAhmad.locator('button[aria-label*="Tema:"]').click() // Toggle to dark
    await sleep(300)
    const tmp = path.join(OUT_DIR, 'phone-exam-dark.png')
    await phoneAhmad.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-exam-dark.webp'), 600, 1298)
    await phoneAhmad.locator('button[aria-label*="Tema:"]').click() // Toggle back to light
    await sleep(300)
  }

  // 11. Phone Warning (600x1298)
  {
    await phoneDodi.evaluate(() => window.dispatchEvent(new Event('blur')))
    await phoneDodi.getByText('Layar ujian terkunci').or(phoneDodi.getByText('Peringatan')).first().waitFor()
    const tmp = path.join(OUT_DIR, 'phone-warning.png')
    await phoneDodi.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-warning.webp'), 600, 1298)
    await phoneDodi.click('text=Saya mengerti, lanjutkan')
    await sleep(2100)
  }

  // Trigger auto-submit on Dodi by firing 2 more violations
  await phoneDodi.evaluate(() => window.dispatchEvent(new Event('blur')))
  await sleep(2100)
  await phoneDodi.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await phoneDodi.close()

  // Ahmad answers all correctly (100)
  for (const [qText, ans] of KEY) {
    const card = phoneAhmad.locator('div:has(p[data-question])', { hasText: qText })
    if (await card.count()) {
      await card.locator('button', { hasText: ans }).click().catch(() => {})
    }
  }
  await phoneAhmad.click('text=Daftar soal').catch(() => {})
  await phoneAhmad.click('text=Kumpulkan jawaban')
  await phoneAhmad.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
  await phoneAhmad.getByText('Selamat, kamu sudah selesai!').waitFor()

  // 12. Phone Done (600x1298)
  {
    const tmp = path.join(OUT_DIR, 'phone-done.png')
    await phoneAhmad.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-done.webp'), 600, 1298)
  }

  // 13. Phone Countdown (600x1298)
  {
    const tmp = path.join(OUT_DIR, 'phone-countdown.png')
    await phoneAhmad.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-countdown.webp'), 600, 1298)
  }

  // Budi answers 3 correctly (75)
  for (let i = 0; i < 3; i++) {
    const [qText, ans] = KEY[i]
    const card = phoneBudi.locator('div:has(p[data-question])', { hasText: qText })
    if (await card.count()) {
      await card.locator('button', { hasText: ans }).click().catch(() => {})
    }
  }
  await phoneBudi.click('text=Daftar soal').catch(() => {})
  await phoneBudi.click('text=Kumpulkan jawaban')
  await phoneBudi.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
  await phoneBudi.getByText('Selamat, kamu sudah selesai!').waitFor()
  await phoneBudi.close()

  // Citra answers all correctly (100)
  for (const [qText, ans] of KEY) {
    const card = phoneCitra.locator('div:has(p[data-question])', { hasText: qText })
    if (await card.count()) {
      await card.locator('button', { hasText: ans }).click().catch(() => {})
    }
  }
  await phoneCitra.click('text=Daftar soal').catch(() => {})
  await phoneCitra.click('text=Kumpulkan jawaban')
  await phoneCitra.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
  await phoneCitra.getByText('Selamat, kamu sudah selesai!').waitFor()
  await phoneCitra.close()

  // Participant 5: Eka Saputra (currently Mengerjakan!)
  const phoneEka = await browser.newPage({ viewport: { width: 600, height: 1298 } })
  await phoneEka.goto(`${BASE}/s/${preCode}`)
  await phoneEka.fill('input[name=name]', 'Eka Saputra')
  await phoneEka.fill('input[name=nim]', '120222005')
  await phoneEka.fill('input[name=prodi]', 'S1 Ilmu Komunikasi')
  await phoneEka.click('text=Masuk ujian')
  await phoneEka.waitForURL(/\/exam\//)

  // 3. Admin Session (1280x800) - Rich active session with stats, charts, hardest questions, and participants!
  await adminPage.goto(preUrl)
  await adminPage.getByText('Ahmad Dahlan').waitFor()
  {
    const tmp = path.join(OUT_DIR, 'admin-session.png')
    await adminPage.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'admin-session.webp'), 1280, 800)
  }

  // 15. Admin Participants Table Element Screenshot (Rich table with multiple participants and expanded log!)
  {
    // Expand Dodi's violation log
    const dodiRow = adminPage.locator('tr:has-text("Dodi Pratama")')
    if (await dodiRow.count()) {
      const summary = dodiRow.locator('summary')
      if (await summary.count()) await summary.click()
    }
    await sleep(200)

    const partSec = adminPage.locator('section:has(h2:has-text("Peserta"))').first()
    if (await partSec.count()) {
      const tmp = path.join(OUT_DIR, 'admin-participants.png')
      await partSec.screenshot({ path: tmp })
      convertToWebp(tmp, path.join(OUT_DIR, 'admin-participants.webp'))
    }
  }

  // Now submit Eka and close session so score is released for Ahmad
  await phoneEka.click('text=Daftar soal').catch(() => {})
  await phoneEka.click('text=Kumpulkan jawaban')
  await phoneEka.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
  await phoneEka.close()

  await adminPage.goto(preUrl)
  adminPage.once('dialog', (dlg) => dlg.accept())
  await adminPage.getByRole('button', { name: 'Tutup sesi', exact: true }).click()
  await adminPage.getByText('Sesi ditutup —').waitFor()

  // 14. Phone Score (600x1298) - Ahmad's released score (100/100)!
  {
    await phoneAhmad.reload()
    await phoneAhmad.getByText('Nilaimu', { exact: true }).waitFor()
    const tmp = path.join(OUT_DIR, 'phone-score.png')
    await phoneAhmad.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-score.webp'), 600, 1298)
    await phoneAhmad.close()
  }

  // Create Post-test session paired with Pre-test
  await adminPage.goto(`${BASE}/admin`)
  await adminPage.getByRole('button', { name: 'Buat sesi baru' }).click()
  await adminPage.fill('input[name=title]', 'Post-test Diklat Dasar KSR 2026')
  await adminPage.fill('input[name=held_on]', '2026-10-15')
  await adminPage.selectOption('select[name=kind]', 'post')
  await adminPage.selectOption('select[name=pre_session_id]', preId)
  await adminPage.selectOption('select[name=timer_mode]', 'total')
  await adminPage.fill('input[name=duration_min]', '15')
  await adminPage.getByRole('button', { name: 'Buat sesi' }).click()
  await adminPage.waitForURL(/\/admin\/sessions\//)
  const postUrl = adminPage.url().split('?')[0]
  const postId = postUrl.split('/admin/sessions/')[1]
  const postCode = (await adminPage.locator('text=/kode [A-Z0-9]{6}/').innerText()).match(/kode ([A-Z0-9]{6})/)![1]

  // Upload questions to Post-test
  await adminPage.click('summary:has-text("Upload file soal")')
  await adminPage.setInputFiles('input[type=file]', CSV)
  await adminPage.click('text=Upload & ganti semua soal')
  await adminPage.getByText('4 soal tersimpan').waitFor()

  // Open Post-test
  await adminPage.click('text=Buka sesi')
  await adminPage.getByText('Lobi dibuka —').waitFor()

  // Ahmad joins Post-test (100)
  const phonePostAhmad = await browser.newPage({ viewport: { width: 600, height: 1298 } })
  await phonePostAhmad.goto(`${BASE}/s/${postCode}`)
  await phonePostAhmad.fill('input[name=name]', 'Ahmad Dahlan')
  await phonePostAhmad.fill('input[name=nim]', '120222001')
  await phonePostAhmad.fill('input[name=prodi]', 'S1 Sistem Informasi')
  await phonePostAhmad.click('text=Masuk ujian')
  await phonePostAhmad.waitForURL(/\/exam\//)

  // Budi joins Post-test (100, up from 75)
  const phonePostBudi = await browser.newPage({ viewport: { width: 600, height: 1298 } })
  await phonePostBudi.goto(`${BASE}/s/${postCode}`)
  await phonePostBudi.fill('input[name=name]', 'Budi Santoso')
  await phonePostBudi.fill('input[name=nim]', '120222002')
  await phonePostBudi.fill('input[name=prodi]', 'S1 Teknik Informatika')
  await phonePostBudi.click('text=Masuk ujian')
  await phonePostBudi.waitForURL(/\/exam\//)

  // Dodi joins Post-test (75, up from 25)
  const phonePostDodi = await browser.newPage({ viewport: { width: 600, height: 1298 } })
  await phonePostDodi.goto(`${BASE}/s/${postCode}`)
  await phonePostDodi.fill('input[name=name]', 'Dodi Pratama')
  await phonePostDodi.fill('input[name=nim]', '120222004')
  await phonePostDodi.fill('input[name=prodi]', 'S1 Teknik Telekomunikasi')
  await phonePostDodi.click('text=Masuk ujian')
  await phonePostDodi.waitForURL(/\/exam\//)

  // Start Post-test
  await adminPage.goto(postUrl)
  adminPage.once('dialog', (d) => d.accept())
  await adminPage.getByRole('button', { name: 'Mulai ujian' }).click()
  await adminPage.getByText('Soal muncul di HP peserta dalam').waitFor()
  await phonePostAhmad.getByText(/Pelanggaran 0 dari/).waitFor({ timeout: 15_000 })
  await phonePostBudi.getByText(/Pelanggaran 0 dari/).waitFor({ timeout: 15_000 })
  await phonePostDodi.getByText(/Pelanggaran 0 dari/).waitFor({ timeout: 15_000 })

  // Answer and submit post-tests
  for (const [qText, ans] of KEY) {
    const cardA = phonePostAhmad.locator('div:has(p[data-question])', { hasText: qText })
    if (await cardA.count()) await cardA.locator('button', { hasText: ans }).click().catch(() => {})
    const cardB = phonePostBudi.locator('div:has(p[data-question])', { hasText: qText })
    if (await cardB.count()) await cardB.locator('button', { hasText: ans }).click().catch(() => {})
  }
  for (let i = 0; i < 3; i++) {
    const [qText, ans] = KEY[i]
    const cardD = phonePostDodi.locator('div:has(p[data-question])', { hasText: qText })
    if (await cardD.count()) await cardD.locator('button', { hasText: ans }).click().catch(() => {})
  }

  await phonePostAhmad.click('text=Daftar soal').catch(() => {})
  await phonePostAhmad.click('text=Kumpulkan jawaban')
  await phonePostAhmad.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
  await phonePostAhmad.close()

  await phonePostBudi.click('text=Daftar soal').catch(() => {})
  await phonePostBudi.click('text=Kumpulkan jawaban')
  await phonePostBudi.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
  await phonePostBudi.close()

  await phonePostDodi.click('text=Daftar soal').catch(() => {})
  await phonePostDodi.click('text=Kumpulkan jawaban')
  await phonePostDodi.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
  await phonePostDodi.close()

  // Close Post-test
  await adminPage.goto(postUrl)
  adminPage.once('dialog', (dlg) => dlg.accept())
  await adminPage.getByRole('button', { name: 'Tutup sesi', exact: true }).click()
  await adminPage.getByText('Sesi ditutup —').waitFor()

  // 2. Admin Home (1280x800) - Both Pre-test and Post-test with realistic stats and filled form!
  {
    await adminPage.goto(`${BASE}/admin`)
    await adminPage.fill('input[name=title]', 'Ujian Remedial Diklat 2026')
    await adminPage.fill('input[name=held_on]', '2026-10-20')
    const tmp = path.join(OUT_DIR, 'admin-home.png')
    await adminPage.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'admin-home.webp'), 1280, 800)
  }

  // 16. Admin Compare (1280x800) - Rich comparison table with multiple participants and positive deltas!
  {
    await adminPage.goto(`${BASE}/admin/compare?pre=${preId}&post=${postId}`)
    await adminPage.locator('table').waitFor()
    const tmp = path.join(OUT_DIR, 'admin-compare.png')
    await adminPage.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'admin-compare.webp'), 1280, 800)
  }

  await browser.close()
  console.log('\nALL 16 DOCUMENTATION SCREENSHOTS REGENERATED WITH RICH PRODUCTION DATA!')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
