'use client'

import { useMemo, useState } from 'react'

export interface NoteItem {
  id: string
  name: string
  nim: string
  text: string
  created_at: string
}

const PAGE_SIZE = 20

export default function NotesSection({
  notesByTab,
}: Readonly<{
  notesByTab: {
    speaker: NoteItem[]
    material: NoteItem[]
    practice: NoteItem[]
    room: NoteItem[]
    next: NoteItem[]
  }
}>) {
  const tabs = [
    { id: 'speaker', label: 'Untuk Pemateri', count: notesByTab.speaker.length },
    { id: 'material', label: 'Materi', count: notesByTab.material.length },
    { id: 'practice', label: 'Praktik', count: notesByTab.practice.length },
    { id: 'room', label: 'Ruangan', count: notesByTab.room.length },
    { id: 'next', label: 'Pertemuan Berikutnya', count: notesByTab.next.length },
  ] as const

  type TabId = (typeof tabs)[number]['id']

  const [activeTab, setActiveTab] = useState<TabId>('speaker')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const activeNotes = notesByTab[activeTab]

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activeNotes
    return activeNotes.filter(
      (n) => n.text.toLowerCase().includes(q) || n.name.toLowerCase().includes(q) || n.nim.toLowerCase().includes(q),
    )
  }, [activeNotes, search])

  const handleTabChange = (t: TabId) => {
    setActiveTab(t)
    setVisibleCount(PAGE_SIZE)
  }

  const pagedNotes = filteredNotes.slice(0, visibleCount)

  return (
    <section aria-labelledby="notes-heading" className="card space-y-4 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="notes-heading" className="display text-lg font-bold text-fg">
            Kritik dan Saran Peserta
          </h2>
          <p className="text-xs text-muted">Masukan kualitatif yang dikelompokkan berdasarkan kategori.</p>
        </div>

        {/* Kolom Cari */}
        <div className="w-full sm:w-72">
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setVisibleCount(PAGE_SIZE)
            }}
            placeholder="Cari saran, nama, atau NIM…"
            className="field w-full text-xs font-normal"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-line pb-3 text-xs">
        {tabs.map((t) => {
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`rounded-lg px-3 py-2 font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                active ? 'bg-primary text-white shadow-xs' : 'bg-surface border border-line text-secondary hover:bg-subtle hover:text-fg'
              }`}
            >
              <span>{t.label}</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[0.68rem] ${active ? 'bg-white/20 text-white' : 'bg-subtle text-muted'}`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Notes List */}
      <div className="space-y-3">
        {filteredNotes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {search ? 'Tidak ada masukan yang cocok dengan pencarian.' : 'Belum ada masukan untuk kategori ini.'}
          </p>
        ) : (
          pagedNotes.map((n) => (
            <div key={n.id} className="rounded-xl border border-line bg-surface p-4 text-xs space-y-2">
              <p className="text-sm text-fg whitespace-pre-wrap leading-relaxed">&ldquo;{n.text}&rdquo;</p>
              <div className="flex items-center justify-between text-muted text-[0.75rem] pt-1 border-t border-line/50">
                <span className="font-semibold text-secondary">
                  {n.name} <span className="font-mono text-muted">({n.nim})</span>
                </span>
                <span>
                  {new Date(n.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Jakarta',
                  })}
                </span>
              </div>
            </div>
          ))
        )}

        {/* Load More Button (Pagination 20) */}
        {visibleCount < filteredNotes.length && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredNotes.length))}
              className="btn btn-secondary text-xs h-10 px-5 cursor-pointer font-semibold"
            >
              Lihat {Math.min(PAGE_SIZE, filteredNotes.length - visibleCount)} lainnya
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
