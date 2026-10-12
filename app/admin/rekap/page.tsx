import Form from 'next/form'
import Link from 'next/link'
import LinkPending from '@/app/link-pending'
import { requireAdmin } from '@/lib/admin-auth'
import { loadRecap } from './data'
import RecapTable from './recap-table'
import SessionSelector from './session-selector'

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

      <Form action="/admin/rekap" className="card space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-fg">Pilih Sesi Ujian</h2>
            <p className="text-xs text-muted">
              Pilih satu atau beberapa sesi untuk menggabungkan rekap data peserta dan nilai.
            </p>
          </div>
        </div>
        {!sessions.length ? (
          <p className="text-muted text-sm py-4">Belum ada sesi yang dibuat.</p>
        ) : (
          <SessionSelector
            sessions={sessions}
            initialSelectedIds={selected.map((s) => s.id)}
          />
        )}
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

          <RecapTable recap={recap} selected={selected} />
        </>
      )}
    </main>
  )
}
