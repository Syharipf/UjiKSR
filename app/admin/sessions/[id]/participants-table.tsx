'use client'

import { useMemo, useState } from 'react'
import SubmitButton from '@/app/submit-button'
import type { Attempt } from '@/lib/exam'
import { resetAttempt } from '../../actions'

type Violation = { id: string; attempt_id: string; type: string; created_at: string }

const STATUS: Record<string, string> = {
  manual: 'Selesai',
  timeout: 'Waktu habis',
  violation: 'Auto-submit (pelanggaran)',
}

const STATUS_STYLE: Record<string, string> = {
  manual: 'bg-ok-soft text-ok',
  timeout: 'bg-subtle text-secondary',
  violation: 'bg-danger-soft text-danger',
  working: 'bg-warn-soft',
  waiting: 'bg-primary-soft text-primary',
}

const VIOLATION_LABELS: Record<string, string> = {
  hidden: 'pindah aplikasi/tab',
  blur: 'hilang fokus',
  fullscreen_exit: 'keluar layar penuh',
  resize: 'layar mengecil (split screen)',
  reopen: 'membuka ulang ujian',
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' })

type FilterTab = 'all' | 'working' | 'finished' | 'violations'

export default function ParticipantsTable({
  sessionId,
  attempts,
  violations,
  started,
  perQuestion,
}: Readonly<{
  sessionId: string
  attempts: Attempt[]
  violations: Violation[]
  started: boolean
  perQuestion: boolean
}>) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterTab>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const byAttempt = useMemo(() => {
    const map = new Map<string, Violation[]>()
    for (const v of violations) {
      const list = map.get(v.attempt_id)
      if (list) list.push(v)
      else map.set(v.attempt_id, [v])
    }
    return map
  }, [violations])

  const counts = useMemo(() => {
    let working = 0
    let finished = 0
    let withViolations = 0
    for (const a of attempts) {
      if (a.submitted_at) finished++
      else working++
      if (a.violation_count > 0) withViolations++
    }
    return { all: attempts.length, working, finished, violations: withViolations }
  }, [attempts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return attempts.filter((a) => {
      if (filter === 'working' && a.submitted_at !== null) return false
      if (filter === 'finished' && a.submitted_at === null) return false
      if (filter === 'violations' && a.violation_count === 0) return false
      if (!q) return true
      return a.name.toLowerCase().includes(q) || a.nim.toLowerCase().includes(q) || (a.prodi && a.prodi.toLowerCase().includes(q))
    })
  }, [attempts, search, filter])

  // Questions done (per question: passed; total: answered).
  const progress = (a: Attempt) => (a.submitted_at ? a.question_order.length : perQuestion ? a.current_index : Object.keys(a.answers).length)

  const copyExamLink = (attemptId: string) => {
    const url = `${window.location.origin}/exam/${attemptId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(attemptId)
      setTimeout(() => setCopiedId((curr) => (curr === attemptId ? null : curr)), 2000)
    }).catch(() => {})
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input */}
        <div className="relative min-w-0 flex-1 max-w-sm">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, NIM, atau prodi..."
            className="field w-full text-sm pl-8"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1 text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-2 font-bold transition-colors ${filter === 'all' ? 'bg-navy text-on-navy' : 'bg-subtle text-secondary hover:text-fg'}`}
          >
            Semua ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setFilter('working')}
            className={`rounded-lg px-3 py-2 font-bold transition-colors ${filter === 'working' ? 'bg-navy text-on-navy' : 'bg-subtle text-secondary hover:text-fg'}`}
          >
            Mengerjakan ({counts.working})
          </button>
          <button
            type="button"
            onClick={() => setFilter('finished')}
            className={`rounded-lg px-3 py-2 font-bold transition-colors ${filter === 'finished' ? 'bg-navy text-on-navy' : 'bg-subtle text-secondary hover:text-fg'}`}
          >
            Selesai ({counts.finished})
          </button>
          <button
            type="button"
            onClick={() => setFilter('violations')}
            className={`rounded-lg px-3 py-2 font-bold transition-colors ${filter === 'violations' ? 'bg-navy text-on-navy' : 'bg-subtle text-secondary hover:text-fg'}`}
          >
            Ada Pelanggaran ({counts.violations})
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left text-xs text-muted">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">NIM</th>
              <th className="p-3">Prodi</th>
              <th className="p-3">Nilai</th>
              <th className="p-3">Pelanggaran</th>
              <th className="p-3">Status</th>
              <th className="p-3">Progres</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-line align-top">
                <td className="p-3 font-medium">{a.name}</td>
                <td className="p-3 font-mono text-xs">{a.nim}</td>
                <td className="p-3 text-secondary">{a.prodi || '–'}</td>
                <td className="p-3 font-bold">{a.score ?? '–'}</td>
                <td className="p-3">
                  {a.violation_count === 0 ? (
                    '0'
                  ) : (
                    <details>
                      <summary className="cursor-pointer font-semibold text-danger">{a.violation_count}</summary>
                      <ul className="mt-1 space-y-0.5 text-xs text-secondary">
                        {(byAttempt.get(a.id) ?? []).map((v) => (
                          <li key={v.id}>
                            {time(v.created_at)} · {VIOLATION_LABELS[v.type] ?? v.type}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </td>
                <td className="p-3">
                  <span className={`badge ${STATUS_STYLE[a.submit_reason ?? (started ? 'working' : 'waiting')] ?? 'bg-subtle text-muted'}`}>
                    {a.submit_reason ? (STATUS[a.submit_reason] ?? a.submit_reason) : started ? 'Mengerjakan' : 'Menunggu'}
                  </span>
                </td>
                <td className="p-3">
                  <Progress done={progress(a)} total={a.question_order.length} />
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => copyExamLink(a.id)}
                      title="Salin link pengerjaan peserta"
                      className="rounded border border-line px-2 py-0.5 text-xs font-medium text-secondary hover:bg-subtle hover:text-fg transition-colors"
                    >
                      {copiedId === a.id ? 'Tersalin! ✓' : 'Salin link'}
                    </button>
                    <form action={resetAttempt.bind(null, sessionId, a.id)}>
                      <SubmitButton
                        confirm={`Reset ${a.name}? Jawabannya dihapus dan peserta ini bisa mulai ulang.`}
                        className="text-xs text-danger underline"
                      >
                        Reset
                      </SubmitButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-muted">
                  {attempts.length === 0 ? 'Belum ada peserta.' : 'Tidak ada peserta yang cocok dengan pencarian / filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Progress({ done, total }: Readonly<{ done: number; total: number }>) {
  return (
    <div className="flex min-w-36 items-center gap-2" title={`${done} dari ${total} soal`}>
      <div aria-hidden className="flex flex-1 gap-0.5">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1.5 min-w-0 flex-1 rounded-sm ${i < done ? 'bg-navy' : 'bg-line'}`} />
        ))}
      </div>
      <span className="w-10 text-right text-xs text-muted">
        {Math.min(done, total)}/{total}
      </span>
    </div>
  )
}
