import Form from 'next/form'
import Link from 'next/link'
import LinkPending from '@/app/link-pending'
import SubmitButton from '@/app/submit-button'
import { requireAdmin } from '@/lib/admin-auth'
import { formatDate } from '@/lib/exam'
import { loadRecap } from './data'

const show = (n: number | null) => (n === null ? '–' : n)

export default async function RekapPage(props: PageProps<'/admin/rekap'>) {
  await requireAdmin()
  const { s } = await props.searchParams
  const wanted = [s ?? []].flat().filter((v): v is string => typeof v === 'string')
  const { sessions, selected, recap } = await loadRecap(wanted)

  const exportQs = new URLSearchParams(selected.map((x) => ['s', x.id])).toString()

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 pb-12">
      <header className="pt-2">
        <Link href="/admin" className="text-sm font-semibold text-muted hover:text-fg">
          ← Semua sesi <LinkPending />
        </Link>
        <h1 className="display mt-2 text-3xl">Rekap peserta &amp; nilai</h1>
      </header>

      <Form action="/admin/rekap" className="card space-y-3 p-4 sm:p-6">
        <p className="text-sm font-semibold">Centang sesi yang ingin direkap.</p>
        {!sessions.length ? (
          <p className="text-muted">Belum ada sesi.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y divide-line">
            {sessions.map((sess) => {
              const isChecked = selected.some((x) => x.id === sess.id)
              return (
                <li key={sess.id}>
                  <label className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-subtle rounded transition-colors">
                    <input
                      type="checkbox"
                      name="s"
                      value={sess.id}
                      defaultChecked={isChecked}
                      className="size-4 rounded accent-primary"
                    />
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                        sess.kind === 'pre' ? 'bg-navy-soft text-navy' : 'bg-primary-soft text-danger'
                      }`}
                    >
                      {sess.kind === 'pre' ? 'Pre-test' : 'Post-test'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-extrabold">{sess.title}</span>
                      <span className="block text-xs text-muted">
                        {formatDate(sess.held_on)} · kode {sess.code}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        <div>
          <SubmitButton className="btn btn-primary">Tampilkan rekap</SubmitButton>
        </div>
      </Form>

      {recap && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <dl className="grid grid-cols-3 gap-3 flex-1">
              <div className="card p-4">
                <dt className="text-xs font-semibold text-muted">Sesi</dt>
                <dd className="mt-1 text-2xl font-extrabold tabular-nums">{selected.length}</dd>
              </div>
              <div className="card p-4">
                <dt className="text-xs font-semibold text-muted">Peserta</dt>
                <dd className="mt-1 text-2xl font-extrabold tabular-nums">{recap.rows.length}</dd>
              </div>
              <div className="card p-4">
                <dt className="text-xs font-semibold text-muted">Rata-rata semua nilai</dt>
                <dd className="mt-1 text-2xl font-extrabold tabular-nums">{show(recap.overall)}</dd>
              </div>
            </dl>
            <div className="flex items-center gap-2">
              <a
                href={`/admin/rekap/export?${exportQs}&format=xlsx`}
                className="btn btn-secondary text-sm"
              >
                Export Excel
              </a>
              <a
                href={`/admin/rekap/export?${exportQs}&format=csv`}
                className="btn btn-secondary text-sm"
              >
                Export CSV
              </a>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="table w-full text-sm">
              <thead className="bg-subtle text-left text-xs text-muted">
                <tr>
                  <th className="p-3">Nama</th>
                  <th className="p-3">NIM</th>
                  <th className="p-3">Prodi</th>
                  {selected.map((s) => (
                    <th key={s.id} className="p-3">
                      <span className="block font-bold text-fg">{s.title}</span>
                      <span className="block font-normal">
                        {s.kind === 'pre' ? 'Pre-test' : 'Post-test'} · {formatDate(s.held_on)} · {s.code}
                      </span>
                    </th>
                  ))}
                  <th className="p-3">Sesi diikuti</th>
                  <th className="p-3">Rata-rata</th>
                </tr>
              </thead>
              <tbody>
                {recap.rows.map((r) => (
                  <tr key={r.nim} className="border-t border-line">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 font-mono">{r.nim}</td>
                    <td className="p-3">{r.prodi || '–'}</td>
                    {r.scores.map((score, idx) => (
                      <td key={selected[idx].id} className="p-3">
                        {show(score)}
                      </td>
                    ))}
                    <td className="p-3">
                      {r.attended}/{selected.length}
                    </td>
                    <td className="p-3 font-semibold">{show(r.average)}</td>
                  </tr>
                ))}
                {!recap.rows.length && (
                  <tr>
                    <td colSpan={selected.length + 5} className="p-3 text-muted text-center">
                      Belum ada peserta.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t border-line font-semibold bg-subtle">
                <tr>
                  <td colSpan={3} className="p-3">
                    Rata-rata
                  </td>
                  {selected.map((s, idx) => (
                    <td key={s.id} className="p-3">
                      {show(recap.sessionAverages[idx])}
                    </td>
                  ))}
                  <td className="p-3" />
                  <td className="p-3 font-bold">{show(recap.overall)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </main>
  )
}
