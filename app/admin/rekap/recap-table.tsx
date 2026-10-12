'use client'

import { useMemo, useState } from 'react'
import type { Session } from '@/lib/exam'
import { formatDate } from '@/lib/exam'
import type { Recap } from '@/lib/report'

const show = (n: number | null) => (n === null ? '–' : n)

type SortField = 'name' | 'nim' | 'prodi' | 'attended' | 'average' | `session_${string}`
type SortOrder = 'asc' | 'desc'
type ScoreTierFilter = 'all' | 'ge80' | '60to79' | 'lt60' | 'null'

export default function RecapTable({
  recap,
  selected,
}: {
  recap: Recap
  selected: Session[]
}) {
  const [search, setSearch] = useState('')
  const [selectedProdi, setSelectedProdi] = useState('all')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [scoreFilter, setScoreFilter] = useState<ScoreTierFilter>('all')

  // Extract distinct prodi list
  const prodiOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of recap.rows) {
      if (r.prodi?.trim()) set.add(r.prodi.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id'))
  }, [recap.rows])

  // Filter & sort rows
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()

    return recap.rows
      .filter((r) => {
        // Search by name or NIM
        if (q && !r.name.toLowerCase().includes(q) && !r.nim.toLowerCase().includes(q)) {
          return false
        }

        // Filter by prodi
        if (selectedProdi !== 'all') {
          if (selectedProdi === 'empty' && r.prodi.trim() !== '') return false
          if (selectedProdi !== 'empty' && r.prodi.trim() !== selectedProdi) return false
        }

        // Filter by average score tier
        if (scoreFilter === 'ge80') {
          if (r.average === null || r.average < 80) return false
        } else if (scoreFilter === '60to79') {
          if (r.average === null || r.average < 60 || r.average >= 80) return false
        } else if (scoreFilter === 'lt60') {
          if (r.average === null || r.average >= 60) return false
        } else if (scoreFilter === 'null') {
          if (r.average !== null) return false
        }

        return true
      })
      .sort((a, b) => {
        let diff = 0
        if (sortField === 'name') {
          diff = a.name.localeCompare(b.name, 'id')
        } else if (sortField === 'nim') {
          diff = a.nim.localeCompare(b.nim, 'id')
        } else if (sortField === 'prodi') {
          diff = (a.prodi || '').localeCompare(b.prodi || '', 'id')
        } else if (sortField === 'attended') {
          diff = a.attended - b.attended
        } else if (sortField === 'average') {
          const aVal = a.average ?? -1
          const bVal = b.average ?? -1
          diff = aVal - bVal
        } else if (sortField.startsWith('session_')) {
          const sessId = sortField.replace('session_', '')
          const idx = selected.findIndex((s) => s.id === sessId)
          if (idx !== -1) {
            const aVal = a.scores[idx] ?? -1
            const bVal = b.scores[idx] ?? -1
            diff = aVal - bVal
          }
        }

        // Secondary fallback sort by name & nim
        if (diff === 0) {
          diff = a.name.localeCompare(b.name, 'id') || a.nim.localeCompare(b.nim, 'id')
        }

        return sortOrder === 'asc' ? diff : -diff
      })
  }, [recap.rows, search, selectedProdi, scoreFilter, sortField, sortOrder, selected])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder(field === 'average' || field === 'attended' || field.startsWith('session_') ? 'desc' : 'asc')
    }
  }

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <span className="ml-1 opacity-30">↕</span>
    }
    return <span className="ml-1 text-primary font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
  }

  return (
    <div className="space-y-4">
      {/* Interactive Controls & Filters */}
      <div className="card p-4 sm:p-5 space-y-3 bg-surface">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search box */}
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Cari Nama / NIM
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ketik nama atau NIM..."
              className="field text-sm font-normal py-1.5"
            />
          </label>

          {/* Prodi filter */}
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Program Studi
            <select
              value={selectedProdi}
              onChange={(e) => setSelectedProdi(e.target.value)}
              className="field text-sm font-normal py-1.5"
            >
              <option value="all">Semua Prodi ({recap.rows.length})</option>
              {prodiOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="empty">Tanpa Prodi / Kosong</option>
            </select>
          </label>

          {/* Average score filter */}
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Filter Rata-rata Nilai
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value as ScoreTierFilter)}
              className="field text-sm font-normal py-1.5"
            >
              <option value="all">Semua Nilai</option>
              <option value="ge80">≥ 80 (Sangat Baik / Istimewa)</option>
              <option value="60to79">60 – 79 (Cukup / Baik)</option>
              <option value="lt60">&lt; 60 (Kurang)</option>
              <option value="null">Belum ada nilai</option>
            </select>
          </label>

          {/* Sort order preset */}
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Urutan Data
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [f, o] = e.target.value.split('-')
                setSortField(f as SortField)
                setSortOrder(o as SortOrder)
              }}
              className="field text-sm font-normal py-1.5"
            >
              <option value="name-asc">Nama (A → Z)</option>
              <option value="name-desc">Nama (Z → A)</option>
              <option value="nim-asc">NIM (Terkecil)</option>
              <option value="nim-desc">NIM (Terbesar)</option>
              <option value="average-desc">Nilai Rata-rata (Tertinggi)</option>
              <option value="average-asc">Nilai Rata-rata (Terendah)</option>
              <option value="attended-desc">Sesi Terbanyak</option>
              <option value="attended-asc">Sesi Tersedikit</option>
            </select>
          </label>
        </div>

        {/* Filter status & reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/60 text-xs text-muted">
          <p>
            Menampilkan <span className="font-bold text-fg">{filteredRows.length}</span> dari{' '}
            <span className="font-semibold text-fg">{recap.rows.length}</span> peserta
            {filteredRows.length < recap.rows.length ? ' (terfilter)' : ''}
          </p>
          {(search || selectedProdi !== 'all' || scoreFilter !== 'all' || sortField !== 'name' || sortOrder !== 'asc') && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setSelectedProdi('all')
                setScoreFilter('all')
                setSortField('name')
                setSortOrder('asc')
              }}
              className="text-xs text-primary font-semibold hover:underline"
            >
              Reset semua filter
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-subtle text-left text-xs text-muted select-none">
            <tr>
              <th className="p-3 cursor-pointer hover:text-fg" onClick={() => toggleSort('name')}>
                <div className="flex items-center">
                  Nama {sortIndicator('name')}
                </div>
              </th>
              <th className="p-3 cursor-pointer hover:text-fg" onClick={() => toggleSort('nim')}>
                <div className="flex items-center">
                  NIM {sortIndicator('nim')}
                </div>
              </th>
              <th className="p-3 cursor-pointer hover:text-fg" onClick={() => toggleSort('prodi')}>
                <div className="flex items-center">
                  Prodi {sortIndicator('prodi')}
                </div>
              </th>
              {selected.map((s) => {
                const sKey: SortField = `session_${s.id}`
                return (
                  <th
                    key={s.id}
                    className="p-3 min-w-44 cursor-pointer hover:text-fg"
                    onClick={() => toggleSort(sKey)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <span className="block font-bold text-fg">{s.title}</span>
                        <span className="block font-normal">
                          {s.kind === 'pre' ? 'Pre-test' : 'Post-test'} · {formatDate(s.held_on)} · {s.code}
                        </span>
                      </div>
                      {sortIndicator(sKey)}
                    </div>
                  </th>
                )
              })}
              <th className="p-3 cursor-pointer hover:text-fg" onClick={() => toggleSort('attended')}>
                <div className="flex items-center">
                  Sesi Diikuti {sortIndicator('attended')}
                </div>
              </th>
              <th className="p-3 cursor-pointer hover:text-fg" onClick={() => toggleSort('average')}>
                <div className="flex items-center">
                  Rata-rata {sortIndicator('average')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.nim} className="border-t border-line hover:bg-subtle/50 transition-colors">
                <td className="p-3 font-medium text-fg">{r.name}</td>
                <td className="p-3 font-mono text-muted">{r.nim}</td>
                <td className="p-3">{r.prodi || '–'}</td>
                {r.scores.map((score, idx) => (
                  <td key={selected[idx].id} className="p-3 font-mono">
                    {score !== null ? (
                      <span className={score >= 80 ? 'text-ok font-semibold' : score < 60 ? 'text-danger' : ''}>
                        {score}
                      </span>
                    ) : (
                      '–'
                    )}
                  </td>
                ))}
                <td className="p-3 text-muted">
                  <span className="font-semibold text-fg">{r.attended}</span>/{selected.length}
                </td>
                <td className="p-3 font-bold font-mono text-fg">
                  {r.average !== null ? (
                    <span className={r.average >= 80 ? 'text-ok' : r.average < 60 ? 'text-danger' : ''}>
                      {r.average}
                    </span>
                  ) : (
                    '–'
                  )}
                </td>
              </tr>
            ))}
            {!filteredRows.length && (
              <tr>
                <td colSpan={selected.length + 5} className="p-6 text-muted text-center">
                  {recap.rows.length === 0 ? 'Belum ada peserta di sesi terpilih.' : 'Tidak ada peserta yang cocok dengan filter yang dipilih.'}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t-2 border-line font-semibold bg-subtle">
            <tr>
              <td colSpan={3} className="p-3 text-fg">
                Rata-rata Keseluruhan ({recap.rows.length} peserta)
              </td>
              {selected.map((s, idx) => (
                <td key={s.id} className="p-3 font-mono">
                  {show(recap.sessionAverages[idx])}
                </td>
              ))}
              <td className="p-3" />
              <td className="p-3 font-extrabold font-mono text-primary text-base">
                {show(recap.overall)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
