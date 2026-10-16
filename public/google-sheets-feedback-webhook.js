/**
 * GOOGLE APPS SCRIPT UNTUK INJECT FEEDBACK UJIKSR KE GOOGLE SHEETS SECARA REAL-TIME
 *
 * CARA PAKAI DI GOOGLE DRIVE:
 * 1. Buka Google Sheets baru atau spreadsheet kegiatan Anda di Google Drive.
 * 2. Pada baris 1 (Header), buat kolom berikut:
 *    A: Timestamp | B: Judul Sesi | C: Kode Sesi | D: Nama | E: NIM | F: Prodi | G: Nilai | H: Rating (1-5) | I: Tingkat Kesulitan | J: Kritik & Saran
 * 3. Di menu atas Google Sheets, klik: Extensions (Ekstensi) -> Apps Script.
 * 4. Hapus kode bawaan, lalu paste seluruh script di bawah ini.
 * 5. Klik tombol "Deploy" (Terapkan) di kanan atas -> "New deployment" (Penerapan baru).
 * 6. Pilih tipe: "Web app" (Aplikasi Web).
 * 7. Atur:
 *    - Description: UjiKSR Feedback Webhook
 *    - Execute as: Me (email Anda)
 *    - Who has access: Anyone (Siapa saja, bahkan anonim) -> WAJIB agar server bisa mengirim data.
 * 8. Klik "Deploy". Salin Web App URL yang berakhiran `/exec`.
 * 9. Paste URL tersebut di form pengaturan sesi Post-test UjiKSR pada field:
 *    "Webhook Google Sheets (Inject Langsung ke Excel Drive)"
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // Append satu baris baru langsung ke Google Sheet saat peserta menekan kirim feedback
    sheet.appendRow([
      data.timestamp || new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      data.session_title || '-',
      data.session_code || '-',
      data.name || '-',
      data.nim || '-',
      data.prodi || '-',
      data.score !== undefined ? data.score : '-',
      data.rating || '-',
      data.difficulty || '-',
      data.comment || '-'
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', message: 'Row inserted successfully' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("UjiKSR Feedback Webhook is active and running.");
}
