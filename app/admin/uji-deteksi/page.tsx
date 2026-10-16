import Link from 'next/link'
import LinkPending from '@/app/link-pending'
import { requireAdmin } from '@/lib/admin-auth'
import Probe from './probe'

export default async function DeteksiPage() {
  await requireAdmin()

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 pb-12">
      <header className="pt-2">
        <Link href="/admin" className="text-sm font-semibold text-muted hover:text-fg">
          ← Semua sesi <LinkPending />
        </Link>
        <h1 className="display mt-2 text-3xl">Uji deteksi HP</h1>
      </header>

      <div className="card p-4 sm:p-6">
        <p className="text-sm text-muted">
          Buka halaman ini di HP dan browser yang akan dipakai peserta, tekan <b className="text-fg">Mulai uji</b>, lalu coba: tarik notifikasi, buka navbar dan tahan Home (Circle to Search/Gemini), pindah aplikasi, split screen, screenshot 3 jari. Baris merah = terhitung pelanggaran; baris abu-abu = event mentah dari browser.
        </p>
      </div>

      <Probe />
    </main>
  )
}
