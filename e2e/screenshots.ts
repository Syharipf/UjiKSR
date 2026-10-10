import { chromium } from 'playwright-core'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const BASE = 'http://localhost:3100'
const CSV = new URL('../public/contoh-soal.csv', import.meta.url).pathname
const OUT_DIR = path.resolve(import.meta.dirname, '../docs/img')

function convertToWebp(pngPath: string, webpPath: string, width?: number, height?: number) {
  const resize = width && height ? `-resize ${width}x${height}\\!` : ''
  execSync(`magick "${pngPath}" ${resize} -quality 92 "${webpPath}"`)
  fs.unlinkSync(pngPath)
  console.log('✓ Saved', path.basename(webpPath))
}

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

  // Admin Context
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

  // 2. Admin Home (1280x800)
  {
    await adminPage.goto(`${BASE}/admin`)
    const tmp = path.join(OUT_DIR, 'admin-home.png')
    await adminPage.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'admin-home.webp'), 1280, 800)
  }

  // 3. Admin Session (1280x800)
  await adminPage.goto(preUrl)
  {
    const tmp = path.join(OUT_DIR, 'admin-session.png')
    await adminPage.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'admin-session.webp'), 1280, 800)
  }

  // 4. Admin Add Question element screenshot
  {
    const details = adminPage.locator('details:has-text("Tambah soal manual")').first()
    if (await details.count()) {
      await details.evaluate((el: HTMLDetailsElement) => { el.open = true })
      await sleep(200)
      const tmp = path.join(OUT_DIR, 'admin-add-question.png')
      await details.screenshot({ path: tmp })
      convertToWebp(tmp, path.join(OUT_DIR, 'admin-add-question.webp'))
      await details.evaluate((el: HTMLDetailsElement) => { el.open = false })
    }
  }

  // 5. Admin Upload CSV element screenshot
  {
    const uploadDetails = adminPage.locator('details:has-text("Upload file soal")').first()
    if (await uploadDetails.count()) {
      await uploadDetails.evaluate((el: HTMLDetailsElement) => { el.open = true })
      await sleep(200)
      const tmp = path.join(OUT_DIR, 'admin-upload-csv.png')
      await uploadDetails.screenshot({ path: tmp })
      convertToWebp(tmp, path.join(OUT_DIR, 'admin-upload-csv.webp'))
      await uploadDetails.evaluate((el: HTMLDetailsElement) => { el.open = false })
    }
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
  // Open the session so join form is accessible
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
  // Join participant Budi
  const phone = await browser.newPage({ viewport: { width: 600, height: 1298 } })
  await phone.goto(`${BASE}/s/${preCode}`)
  await phone.fill('input[name=name]', 'Budi Santoso')
  await phone.fill('input[name=nim]', '120222002')
  await phone.fill('input[name=prodi]', 'S1 Teknik Informatika')
  await phone.click('text=Masuk ujian')
  await phone.waitForURL(/\/exam\//)

  // Start exam from admin
  adminPage.once('dialog', (d) => d.accept())
  await adminPage.getByRole('button', { name: 'Mulai ujian' }).click()
  await adminPage.getByText('Soal muncul di HP peserta dalam').waitFor()
  await phone.getByText(/Pelanggaran 0 dari/).waitFor({ timeout: 15_000 })

  // 9. Phone Exam Light (600x1298)
  {
    await phone.locator('main [role=group] button').first().click()
    const tmp = path.join(OUT_DIR, 'phone-exam.png')
    await phone.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-exam.webp'), 600, 1298)
  }

  // 10. Phone Exam Dark (600x1298)
  {
    await phone.locator('button[aria-label*="Tema:"]').click() // Toggle to dark
    await sleep(300)
    const tmp = path.join(OUT_DIR, 'phone-exam-dark.png')
    await phone.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-exam-dark.webp'), 600, 1298)
    await phone.locator('button[aria-label*="Tema:"]').click() // Toggle back to light
    await sleep(300)
  }

  // 11. Phone Warning (600x1298)
  {
    await phone.evaluate(() => window.dispatchEvent(new Event('blur')))
    await phone.getByText('Layar ujian terkunci').or(phone.getByText('Peringatan')).first().waitFor()
    const tmp = path.join(OUT_DIR, 'phone-warning.png')
    await phone.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-warning.webp'), 600, 1298)
    await phone.click('text=Saya mengerti, lanjutkan')
    await sleep(500)
  }

  // Answer remaining questions and submit
  const buttons = phone.locator('main [role=group] button:first-child')
  const count = await buttons.count()
  for (let i = 0; i < count; i++) {
    await buttons.nth(i).click().catch(() => {})
  }
  await phone.click('text=Daftar soal').catch(() => {})
  await phone.click('text=Kumpulkan jawaban')
  await phone.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
  await phone.getByText('Selamat, kamu sudah selesai!').waitFor()

  // 12. Phone Done (600x1298)
  {
    const tmp = path.join(OUT_DIR, 'phone-done.png')
    await phone.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-done.webp'), 600, 1298)
  }

  // 13. Phone Countdown (600x1298)
  {
    const tmp = path.join(OUT_DIR, 'phone-countdown.png')
    await phone.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-countdown.webp'), 600, 1298)
  }

  // Close session from admin so score is released
  await adminPage.goto(preUrl)
  await adminPage.getByRole('button', { name: 'Tutup sesi', exact: true }).click()
  await adminPage.getByText('Sesi ditutup —').waitFor()

  // 14. Phone Score (600x1298)
  {
    await phone.reload()
    await phone.getByText('Nilaimu', { exact: true }).waitFor()
    const tmp = path.join(OUT_DIR, 'phone-score.png')
    await phone.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'phone-score.webp'), 600, 1298)
    await phone.close()
  }

  // 15. Admin Participants Table Element Screenshot
  {
    await adminPage.goto(preUrl)
    await adminPage.getByText('Budi Santoso').waitFor()
    const partSec = adminPage.locator('section:has(h2:has-text("Peserta"))').first()
    if (await partSec.count()) {
      const tmp = path.join(OUT_DIR, 'admin-participants.png')
      await partSec.screenshot({ path: tmp })
      convertToWebp(tmp, path.join(OUT_DIR, 'admin-participants.webp'))
    }
  }

  // 16. Admin Compare (1280x800)
  {
    // Create Post-test session paired with pre-test
    await adminPage.goto(`${BASE}/admin`)
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

    // Budi joins Post-test and answers
    const phonePost = await browser.newPage({ viewport: { width: 600, height: 1298 } })
    await phonePost.goto(`${BASE}/s/${postCode}`)
    await phonePost.fill('input[name=name]', 'Budi Santoso')
    await phonePost.fill('input[name=nim]', '120222002')
    await phonePost.fill('input[name=prodi]', 'S1 Teknik Informatika')
    await phonePost.click('text=Masuk ujian')
    await phonePost.waitForURL(/\/exam\//)

    // Start Post-test
    adminPage.once('dialog', (d) => d.accept())
    await adminPage.getByRole('button', { name: 'Mulai ujian' }).click()
    await phonePost.getByText(/Pelanggaran 0 dari/).waitFor({ timeout: 15_000 })

    // Answer all and submit
    const postBtns = phonePost.locator('main [role=group] button:first-child')
    const postCount = await postBtns.count()
    for (let i = 0; i < postCount; i++) {
      await postBtns.nth(i).click().catch(() => {})
    }
    await phonePost.click('text=Daftar soal').catch(() => {})
    await phonePost.click('text=Kumpulkan jawaban')
    await phonePost.getByRole('button', { name: 'Kumpulkan', exact: true }).click()
    await phonePost.getByText('Selamat, kamu sudah selesai!').waitFor()
    await phonePost.close()

    // Close Post-test
    await adminPage.goto(postUrl)
    await adminPage.getByRole('button', { name: 'Tutup sesi', exact: true }).click()
    await adminPage.getByText('Sesi ditutup —').waitFor()

    // Open Compare Page
    await adminPage.goto(`${BASE}/admin/compare?pre=${preId}&post=${postId}`)
    await adminPage.locator('table').waitFor()
    const tmp = path.join(OUT_DIR, 'admin-compare.png')
    await adminPage.screenshot({ path: tmp })
    convertToWebp(tmp, path.join(OUT_DIR, 'admin-compare.webp'), 1280, 800)
  }

  await browser.close()
  console.log('\nALL 16 DOCUMENTATION SCREENSHOTS REGENERATED SUCCESSFULLY!')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
