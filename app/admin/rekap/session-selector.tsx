'use client'

import { useMemo, useState } from 'react'
import SubmitButton from '@/app/submit-button'
import type { Session } from '@/lib/exam'
import { formatDate } from '@/lib/exam'

type KindFilter = 'all' | 'pre' | 'post'

export default function SessionSelector({
  sessions,
  initialSelectedIds,
}: {
  sessions: Session[]
  initialSelectedIds: string[]
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialSelectedIds))
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [dateFilter, setDateFilter] = useState('all')

  // Extract distinct dates (sorted descending)
  const dateOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of sessions) {
      if (!map.has(s.held_on)) {
        map.set(s.held_on, formatDate(s.held_on))
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [sessions])

  // Filtered session list
  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sessions.filter((s) => {
      if (kindFilter !== 'all' && s.kind !== kindFilter) return false
      if (dateFilter !== 'all' && s.held_on !== dateFilter) return false
      if (!q) return true
      return (
        s.title.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        formatDate(s.held_on).toLowerCase().includes(q)
      )
    })
  }, [sessions, search, kindFilter, dateFilter])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const s of filteredSessions) {
        next.add(s.id)
      }
      return next
    })
  }

  const deselectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const s of filteredSessions) {
        next.delete(s.id)
      }
      return next
    })
  }

  const resetAll = () => {
    setSelectedIds(new Set())
  }

  const allFilteredSelected =
    filteredSessions.length > 0 && filteredSessions.every((s) => selectedIds.has(s.id))

  return (
    <div className="space-y-4">
      {/* Control bar: search, filters, actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-44 flex-1 sm:max-w-xs">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul, kode, atau tanggal..."
              className="field text-xs w-full pl-8 py-1.5"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="field text-xs py-1.5 min-w-36"
          >
            <option value="all">Semua Tanggal ({dateOptions.length})</option>
            {dateOptions.map(([dateVal, dateLabel]) => (
              <option key={dateVal} value={dateVal}>
                {dateLabel}
              </option>
            ))}
          </select>

          {/* Kind Filter (Pre / Post) */}
          <div className="inline-flex rounded-lg border border-line bg-subtle p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setKindFilter('all')}
              className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                kindFilter === 'all' ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('pre')}
              className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                kindFilter === 'pre' ? 'bg-navy text-on-navy shadow-xs' : 'text-muted hover:text-fg'
              }`}
            >
              Pre-test
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('post')}
              className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                kindFilter === 'post' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-fg'
              }`}
            >
              Post-test
            </button>
          </div>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={allFilteredSelected ? deselectAllFiltered : selectAllFiltered}
            className="btn btn-secondary text-xs py-1.5 px-3 h-auto"
          >
            {allFilteredSelected ? 'Batal Pilih Hasil' : 'Pilih Semua Hasil'}
          </button>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={resetAll}
              className="text-xs text-muted hover:text-danger font-medium underline"
            >
              Kosongkan ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Grid of Sessions (2 cols on tablet, 3 cols on desktop) */}
      {!filteredSessions.length ? (
        <div className="p-8 text-center text-sm text-muted bg-subtle/50 rounded-xl border border-dashed border-line">
          Tidak ada sesi yang cocok dengan filter atau kata kunci di atas.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 max-h-[360px] overflow-y-auto pr-1">
          {filteredSessions.map((sess) => {
            const isChecked = selectedIds.has(sess.id)
            return (
              <label
                key={sess.id}
                className={`relative flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  isChecked
                    ? 'border-primary/50 bg-primary-soft/30 shadow-xs'
                    : 'border-line bg-surface hover:bg-subtle/60'
                }`}
              >
                <input
                  type="checkbox"
                  name="s"
                  value={sess.id}
                  checked={isChecked}
                  onChange={() => toggleSelect(sess.id)}
                  className="size-4 mt-0.5 rounded accent-primary shrink-0 cursor-pointer"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
                        sess.kind === 'pre' ? 'bg-navy-soft text-navy' : 'bg-primary-soft text-danger'
                      }`}
                    >
                      {sess.kind === 'pre' ? 'Pre-test' : 'Post-test'}
                    </span>
                    <span className="font-mono text-xs font-semibold text-muted bg-subtle px-1.5 py-0.5 rounded">
                      {sess.code}
                    </span>
                  </div>
                  <p className="font-bold text-sm text-fg leading-snug line-clamp-2">
                    {sess.title}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(sess.held_on)}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
      )}

      {/* Hidden inputs for selected sessions that are currently filtered out by view */}
      {Array.from(selectedIds).map((id) => {
        const isRenderedInFiltered = filteredSessions.some((s) => s.id === id)
        if (isRenderedInFiltered) return null
        return <input key={`hidden-${id}`} type="hidden" name="s" value={id} />
      })}

      {/* Footer bar with submit button and counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line">
        <div className="text-xs text-muted">
          Terpilih:{' '}
          <span className="font-bold text-fg text-sm tabular-nums">
            {selectedIds.size}
          </span>{' '}
          dari {sessions.length} sesi
        </div>
        <SubmitButton className="btn btn-primary text-sm py-2 px-5">
          Tampilkan Rekap {selectedIds.size > 0 ? `(${selectedIds.size} Sesi)` : ''}
        </SubmitButton>
      </div>
    </div>
  )
}
