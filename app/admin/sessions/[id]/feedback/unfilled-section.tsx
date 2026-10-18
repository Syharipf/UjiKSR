'use client'

import { useMemo, useState } from 'react'

export interface UnfilledParticipant {
  id: string
  name: string
  nim: string
  prodi: string
  submitted_at: string | null
}

export default function UnfilledFeedbackSection({
  participants,
}: Readonly<{
  participants: UnfilledParticipant[]
}>) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'submitted' | 'working'>('all')
  const [copied, setCopied] = useState(false)
  const [copiedNim, setCopiedNim] = useState<string | null>(null)

  const counts = useMemo(() => {
    let submitted = 0
    let working = 0
    for (const p of participants) {
      if (p.submitted_at) submitted++
      else working++
    }
    return { all: participants.length, submitted, working }
  }, [participants])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return participants.filter((p) => {
      if (filter === 'submitted' && !p.submitted_at) return false
      if (filter === 'working' && p.submitted_at) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.nim.toLowerCase().includes(q) ||
        p.prodi.toLowerCase().includes(q)
      )
    })
  }, [participants, search, filter])

  const copyAllNims = async () => {
    const nims = filtered.map((p) => p.nim).filter(Boolean).join(', ')
    if (!nims) return
    try {
      await navigator.clipboard.writeText(nims)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore clipboard error
    }
  }

  const copySingleNim = async (nim: string) => {
    try {
      await navigator.clipboard.writeText(nim)
      setCopiedNim(nim)
      setTimeout(() => setCopiedNim(null), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <section id="belum-mengisi" aria-labelledby="unfilled-feedback-heading" className="card space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 id="unfilled-feedback-heading" className="display text-lg font-bold text-fg">
              Peserta Belum Mengisi Feedback
            </h2>
            <span className={`badge text-xs font-bold px-2 py-0.5 rounded-full ${participants.length > 0 ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok'}`}>
              {participants.length}
            </span>
          </div>
          <p className="text-xs text-muted">
            Daftar peserta ujian yang belum mengirimkan feedback atau evaluasi kegiatan.
          </p>
        </div>

        {participants.length > 0 && (
          <button
            type="button"
            onClick={copyAllNims}
            className="btn btn-secondary text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>{copied ? '✓ NIM Berhasil Disalin!' : '📋 Salin Semua NIM'}</span>
            <span className="opacity-70">({filtered.length})</span>
          </button>
        )}
      </div>

      {participants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ok">
          🎉 Luar biasa! Semua peserta di sesi ini sudah mengisi feedback.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap gap-1 rounded-lg bg-subtle p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  filter === 'all' ? 'bg-surface font-semibold text-fg shadow-sm' : 'text-muted hover:text-fg'
                }`}
              >
                Semua ({counts.all})
              </button>
              <button
                type="button"
                onClick={() => setFilter('submitted')}
                className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  filter === 'submitted' ? 'bg-surface font-semibold text-fg shadow-sm' : 'text-muted hover:text-fg'
                }`}
              >
                Sudah selesai ujian ({counts.submitted})
              </button>
              <button
                type="button"
                onClick={() => setFilter('working')}
                className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  filter === 'working' ? 'bg-surface font-semibold text-fg shadow-sm' : 'text-muted hover:text-fg'
                }`}
              >
                Masih mengerjakan ({counts.working})
              </button>
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, NIM, atau prodi..."
              className="field text-xs py-1.5 px-3 w-full sm:w-64"
            />
          </div>

          <div className="max-h-[380px] overflow-y-auto rounded-xl border border-line bg-surface">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">Tidak ada peserta yang cocok dengan filter.</p>
            ) : (
              <ul className="divide-y divide-line text-xs">
                {filtered.map((p) => {
                  const isFinished = Boolean(p.submitted_at)
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-subtle/40 transition-colors">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-fg truncate">{p.name}</span>
                          <button
                            type="button"
                            onClick={() => copySingleNim(p.nim)}
                            title="Klik untuk salin NIM"
                            className="font-mono text-muted text-[0.7rem] hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span>{p.nim}</span>
                            {copiedNim === p.nim ? (
                              <span className="text-ok font-sans font-bold text-[0.65rem]">✓ disalin</span>
                            ) : (
                              <span className="opacity-50">📋</span>
                            )}
                          </button>
                        </div>
                        {p.prodi && <p className="text-[0.7rem] text-muted truncate">{p.prodi}</p>}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`badge text-[0.7rem] px-2 py-0.5 rounded-full font-medium ${
                            isFinished ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'
                          }`}
                        >
                          {isFinished ? 'Selesai ujian' : 'Mengerjakan'}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
