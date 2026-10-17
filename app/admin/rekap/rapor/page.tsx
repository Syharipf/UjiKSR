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
    <main className="mx-auto max-w-3xl space-y-5 p-6 print:max-w-none print:p-0">
      {/* A4 with real margins; the browser's own header/footer (URL, date) is turned off by margin: 0 on the page box. */}
      <style>{'@page { size: A4; margin: 0 } @media print { html, body { background: #fff !important } }'}</style>
      <div className="flex items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted">Di jendela cetak, pilih tujuan &quot;Simpan sebagai PDF&quot;.</p>
        <PrintButton />
      </div>

      <article className="space-y-7 rounded-2xl bg-white p-10 text-[#1a1d23] shadow-sm tabular-nums print:rounded-none print:p-[18mm] print:shadow-none [&_.text-muted]:text-[#5b6472]">
        <header className="flex items-center justify-between gap-6 border-b-[3px] border-[#c8102e] pb-5">
          <Brand />
          <div className="text-right">
            <h1 className="display text-[1.6rem] leading-none">Rapor Peserta</h1>
            <p className="mt-1.5 text-xs text-[#5b6472]">Pre-test &amp; post-test</p>
          </div>
        </header>

        <section className="flex items-end justify-between gap-6">
          <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-[#5b6472]">Nama</dt>
            <dd className="font-bold">{row.name}</dd>
            <dt className="text-[#5b6472]">NIM</dt>
            <dd>{row.nim}</dd>
            <dt className="text-[#5b6472]">Program studi</dt>
            <dd>{row.prodi || '–'}</dd>
          </dl>
          <div className="shrink-0 text-right">
            <p className="text-xs text-[#5b6472]">Rata-rata nilai</p>
            <p className="display text-4xl leading-tight">{show(row.average)}</p>
            <p className="text-xs text-[#5b6472]">
              {row.attended} dari {selected.length} ujian diikuti
            </p>
          </div>
        </section>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1d23] text-left text-xs text-[#5b6472]">
              <th className="py-2 pr-3 font-semibold">Ujian</th>
              <th className="py-2 pr-3 font-semibold">Jenis</th>
              <th className="py-2 pr-3 font-semibold">Tanggal</th>
              <th className="py-2 text-right font-semibold">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {selected.map((s, i) => (
              <tr key={s.id} className="border-b border-[#e3e6eb]">
                <td className="py-2.5 pr-3">{s.title}</td>
                <td className="py-2.5 pr-3 text-[#5b6472]">{s.kind === 'pre' ? 'Pre-test' : 'Post-test'}</td>
                <td className="py-2.5 pr-3 text-[#5b6472]">{formatDate(s.held_on)}</td>
                <td className="py-2.5 text-right font-bold">
                  {row.scores[i] ?? <span className="font-normal text-[#5b6472]">tidak ikut</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pairs.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="text-xs font-semibold text-[#5b6472]">Perkembangan pre-test → post-test</h2>
            <ul className="divide-y divide-[#e3e6eb] rounded-lg border border-[#e3e6eb] text-sm">
              {pairs.map((p) => (
                <li key={p.post} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span>{selected[p.post].title.replace(/^\s*post[- ]?test\s*/i, '') || selected[p.post].title}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-[#5b6472]">
                      {show(row.scores[p.pre])} → {show(row.scores[p.post])}
                    </span>
                    <b className={`w-12 text-right ${p.delta === null ? 'font-normal text-[#5b6472]' : p.delta >= 0 ? 'text-[#1b7a3e]' : 'text-[#c8102e]'}`}>
                      {p.delta === null ? '–' : `${p.delta > 0 ? '+' : ''}${p.delta}`}
                    </b>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="flex justify-between gap-4 border-t border-[#e3e6eb] pt-3 text-xs text-[#5b6472]">
          <span>KSR PMI Unit Universitas Telkom</span>
          <span>Dicetak {new Date().toLocaleDateString('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' })}</span>
        </footer>
      </article>
    </main>
  )
}
