'use client'

import { useState } from 'react'

export interface MaterialGroup {
  normalized: string
  original: string
  count: number
  participants: { name: string; nim: string }[]
}

export default function MaterialsSection({
  groups,
}: Readonly<{
  groups: MaterialGroup[]
}>) {
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  return (
    <section aria-labelledby="materi-heading" className="card space-y-4 p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id="materi-heading" className="display text-lg font-bold text-fg">
          Materi yang Ditulis Peserta
        </h2>
        <p className="text-xs text-muted">
          Jawaban pertanyaan 01 dikelompokkan berdasarkan kemiripan teks untuk mengecek apakah peserta menyimak materi.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Belum ada respon materi.</p>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => {
            const isOpen = openGroup === g.normalized
            return (
              <div key={g.normalized} className="rounded-xl border border-line bg-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenGroup(isOpen ? null : g.normalized)}
                  className="w-full flex items-center justify-between p-3.5 text-left hover:bg-subtle/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <span className="badge bg-primary text-white font-extrabold text-xs px-2.5 py-0.5 rounded-full shrink-0">
                      {g.count}
                    </span>
                    <span className="font-semibold text-sm text-fg truncate">{g.original}</span>
                  </div>
                  <span className="text-xs text-muted font-medium shrink-0">
                    {isOpen ? 'Tutup ▲' : 'Lihat nama ▼'}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-line bg-subtle/30 p-3.5 text-xs space-y-1.5 animate-in">
                    <p className="font-semibold text-muted mb-2">Peserta yang menulis jawaban ini ({g.participants.length}):</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {g.participants.map((p, idx) => (
                        <li key={idx} className="flex items-center gap-1.5 truncate text-secondary">
                          <span className="size-1.5 rounded-full bg-primary shrink-0" />
                          <span className="font-medium text-fg truncate">{p.name}</span>
                          <span className="font-mono text-muted text-[0.7rem]">({p.nim})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
