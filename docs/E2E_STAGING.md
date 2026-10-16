# Panduan E2E Testing Staging

Dokumen ini menjelaskan cara menjalankan pengujian otomatis end-to-end (E2E) terhadap environment **Staging** (Vercel Preview / Remote server).

---

## 1. Keuntungan E2E Otomatis
- **Tidak perlu HP fisik**: Seluruh peran peserta (buka kamera, masuk lobi, fullscreen, isi nama/NIM, jawab soal, simulasi pelanggaran tab) disimulasikan otomatis oleh Playwright dengan emulasi layar mobile (`Pixel 7`).
- **Cepat & Menyeluruh**: Menguji seluruh alur panitia & peserta (mode total timer, mode per-soal, auto-close timer, join pre/post test compare) dalam satu kali jalan.

---

## 2. Prasyarat Environment Staging
Sebelum menjalankan E2E ke staging, pastikan:
1. **URL Staging Aktif**: Deployment staging diakses dan merespons HTTP 200 (misalnya `https://staging-ujiksr.vercel.app`).
2. **Database Staging Terisolasi**:
   - Skrip E2E akan membuat sesi baru (`Pre-test E2E`, `Post-test E2E`, `Manual E2E`), mengunggah soal contoh, dan membuat attempt peserta dummy (Ani, Budi, Citra, Dodi, Eka).
   - Skrip juga menguji fitur hapus sesi (`Sesi Hapus E2E`).
   - **PENTING**: Jangan jalankan terhadap database Production yang sedang digunakan untuk ujian aktif! Gunakan Supabase project staging atau database non-produksi.
3. **Password Admin Staging**: Ketahui nilai `ADMIN_PASSWORD` yang diset pada environment staging.

---

## 3. Cara Menjalankan

Jalankan perintah berikut dari terminal:

```bash
STAGING_URL="https://staging-ujiksr.vercel.app" ADMIN_PASSWORD="password_admin_staging" bun run e2e:staging
```

Atau menggunakan opsi `E2E_BASE_URL`:

```bash
E2E_BASE_URL="https://staging-ujiksr.vercel.app" ADMIN_PASSWORD="password_admin_staging" bun run e2e:staging
```

### Opsi Custom Chromium (Opsional)
Script otomatis mendeteksi Chromium di sistem (`/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`). Jika menggunakan path kustom:

```bash
CHROMIUM_PATH="/path/to/chromium" STAGING_URL="https://..." ADMIN_PASSWORD="..." bun run e2e:staging
```

---

## 4. Troubleshooting
- **Error: Target URL tidak dapat diakses atau timeout**: Periksa koneksi internet atau status deployment Vercel staging.
- **Password salah**: Pastikan `ADMIN_PASSWORD` yang dipassing sama dengan env variable yang terpasang di Vercel/server staging.
- **Rate limiting / WAF**: Jika deployment staging berada di balik protection (Cloudflare/Vercel Deployment Protection), nonaktifkan sementara bypass protection untuk IP runner atau gunakan header bypass.
