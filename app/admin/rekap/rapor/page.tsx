import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Brand from '@/app/brand'
import { requireAdmin } from '@/lib/admin-auth'
import { formatDate } from '@/lib/exam'
import { progressPairs } from '@/lib/report'
import { loadRecap } from '../data'
import PrintButton from './print-button'

type Props = PageProps<'/admin/rekap/rapor'>

async function load(props: Props) {
  await requireAdmin()
  const { s, nim } = await props.searchParams
  const wanted = [s ?? []].flat().filter((v): v is string => typeof v === 'string')
  const { selected, recap } = await loadRecap(wanted)
  const key = String(nim ?? '').trim().toUpperCase()
  const row = recap?.rows.find((r) => r.nim.toUpperCase() === key)
  if (!row) notFound()
  return { selected, row }
}

// The title becomes the file name of "Save as PDF".
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { row } = await load(props)
  return { title: `Rapor ${row.nim} ${row.name}` }
}

const show = (n: number | null) => (n === null ? '–' : n)

export default async function RaporPage(props: Props) {
  const { selected, row } = await load(props)
  const pairs = progressPairs(selected, row.scores)

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 print:max-w-none print:p-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted">Pilih &quot;Simpan sebagai PDF&quot; di jendela cetak untuk mengunduh.</p>
        <PrintButton />
      </div>

      <article className="space-y-6 rounded-2xl bg-white p-8 text-black shadow-sm print:rounded-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b-4 border-[#c8102e] pb-4">
          <Brand />
          <div className="text-right">
            <h1 className="display text-2xl">Rapor Peserta</h1>
            <p className="text-sm text-neutral-600">Pre-test &amp; post-test</p>
          </div>
        </header>

        <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
          <dt className="text-neutral-600">Nama</dt>
          <dd className="font-semibold">{row.name}</dd>
          <dt className="text-neutral-600">NIM</dt>
          <dd className="font-mono">{row.nim}</dd>
          <dt className="text-neutral-600">Program studi</dt>
          <dd>{row.prodi || '–'}</dd>
        </dl>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-neutral-800 text-left">
              <th className="py-2 pr-3">Ujian</th>
              <th className="py-2 pr-3">Jenis</th>
              <th className="py-2 pr-3">Tanggal</th>
              <th className="py-2 text-right">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {selected.map((s, i) => (
              <tr key={s.id} className="border-b border-neutral-300">
                <td className="py-2 pr-3">{s.title}</td>
                <td className="py-2 pr-3">{s.kind === 'pre' ? 'Pre-test' : 'Post-test'}</td>
                <td className="py-2 pr-3">{formatDate(s.held_on)}</td>
                <td className="py-2 text-right font-mono font-semibold">{row.scores[i] ?? 'Tidak ikut'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-2 font-semibold">
                Rata-rata ({row.attended} dari {selected.length} ujian)
              </td>
              <td className="py-2 text-right font-mono text-base font-extrabold">{show(row.average)}</td>
            </tr>
          </tfoot>
        </table>

        {pairs.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-bold">Perkembangan</h2>
            <ul className="space-y-1 text-sm">
              {pairs.map((p) => (
                <li key={p.post}>
                  {selected[p.post].title}: {show(row.scores[p.pre])} → {show(row.scores[p.post])}
                  {p.delta !== null && (
                    <b className={p.delta >= 0 ? 'text-green-700' : 'text-[#c8102e]'}> ({p.delta >= 0 ? '+' : ''}{p.delta})</b>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="border-t border-neutral-300 pt-3 text-xs text-neutral-500">
          KSR PMI Unit Universitas Telkom · dicetak {new Date().toLocaleDateString('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' })}
        </footer>
      </article>
    </main>
  )
}
