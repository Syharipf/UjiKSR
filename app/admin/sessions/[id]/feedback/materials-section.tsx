'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export interface MaterialGroup {
  normalized: string
  original: string
  count: number
  participants: { name: string; nim: string }[]
}

const INITIAL_BATCH = 15
const BATCH_SIZE = 15

export default function MaterialsSection({
  groups,
}: Readonly<{
  groups: MaterialGroup[]
}>) {
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH)
  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups.filter(
      (g) =>
        g.original.toLowerCase().includes(q) ||
        g.participants.some(
          (p) => p.name.toLowerCase().includes(q) || p.nim.toLowerCase().includes(q),
        ),
    )
  }, [groups, search])


  // IntersectionObserver for infinite scrolling inside the container
  useEffect(() => {
    const sentinel = sentinelRef.current
    const container = containerRef.current
    if (!sentinel || !container) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(filtered.length, prev + BATCH_SIZE))
        }
      },
      {
        root: container,
        rootMargin: '100px',
      },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [filtered.length])

  // Fallback scroll listener for infinite scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 120) {
      setVisibleCount((prev) => Math.min(filtered.length, prev + BATCH_SIZE))
    }
  }

  const visibleGroups = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  return (
    <section aria-labelledby="materi-heading" className="card space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 id="materi-heading" className="display text-lg font-bold text-fg">
              Materi yang Ditulis Peserta
            </h2>
            <span className="badge text-xs font-bold px-2 py-0.5 rounded-full bg-subtle text-secondary">
              {groups.length} kelompok
            </span>
          </div>
          <p className="text-xs text-muted">
            Jawaban pertanyaan 01 dikelompokkan berdasarkan kemiripan teks untuk mengecek apakah peserta menyimak materi.
          </p>
        </div>

        {groups.length > 5 && (
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setVisibleCount(INITIAL_BATCH)
            }}
            placeholder="Cari materi atau nama peserta..."
            className="field text-xs py-1.5 px-3 w-full sm:w-64"
          />
        )}
      </div>

      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Belum ada respon materi.</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-subtle/30 p-6 text-center text-xs text-muted">
          Tidak ada materi yang cocok dengan pencarian &quot;{search}&quot;.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted px-1">
            <span>
              Menampilkan {visibleGroups.length} dari {filtered.length} materi
            </span>
            {hasMore && (
              <span className="text-[0.7rem] text-secondary">
                Gulir ke bawah untuk memuat otomatis
              </span>
            )}
          </div>

          {/* Scrollable Container with Infinite Scroll */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="max-h-[500px] overflow-y-auto rounded-xl border border-line bg-subtle/20 p-2.5 sm:p-3 space-y-2"
          >
            {visibleGroups.map((g) => {
              const isOpen = openGroup === g.normalized
              return (
                <div key={g.normalized} className="rounded-xl border border-line bg-surface overflow-hidden transition-colors">
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

            {/* Sentinel for infinite scroll trigger */}
            <div ref={sentinelRef} className="py-2 text-center text-xs text-muted">
              {hasMore ? (
                <span className="inline-flex items-center gap-1.5 animate-pulse">
                  <span>Memuat materi lainnya...</span>
                </span>
              ) : (
                <span className="text-[0.7rem] text-muted">
                  Semua {filtered.length} materi telah ditampilkan
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
