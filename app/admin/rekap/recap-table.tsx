'use client'

import { useMemo, useState } from 'react'
import type { Session } from '@/lib/exam'
import { formatDate } from '@/lib/exam'
import type { Recap } from '@/lib/report'

const show = (n: number | null) => (n === null ? '–' : n)

type SortField = 'name' | 'nim' | 'prodi' | 'attended' | 'average' | `session_${string}`
type SortOrder = 'asc' | 'desc'
type ScoreTierFilter = 'all' | 'ge80' | '70to79' | '60to69' | 'lt60' | 'null'
type AttendanceFilter = 'all' | 'full' | 'partial' | 'none'
type PassFilter = 'all' | 'passed' | 'failed'

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
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>('all')
  const [passFilter, setPassFilter] = useState<PassFilter>('all')
  const [minScore, setMinScore] = useState<string>('')
  const [maxScore, setMaxScore] = useState<string>('')
  const [targetSessionFilter, setTargetSessionFilter] = useState<string>('all')
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
    const minVal = minScore.trim() !== '' ? Number(minScore) : null
    const maxVal = maxScore.trim() !== '' ? Number(maxScore) : null

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

        // Filter by attendance status
        if (attendanceFilter === 'full' && r.attended < selected.length) return false
        if (attendanceFilter === 'partial' && (r.attended === 0 || r.attended >= selected.length)) return false
        if (attendanceFilter === 'none' && r.attended > 0) return false

        // Filter by pass status (standard passing grade >= 70)
        if (passFilter === 'passed') {
          if (r.average === null || r.average < 70) return false
        } else if (passFilter === 'failed') {
          if (r.average !== null && r.average >= 70) return false
        }

        // Filter by score tier
        if (scoreFilter === 'ge80') {
          if (r.average === null || r.average < 80) return false
        } else if (scoreFilter === '70to79') {
          if (r.average === null || r.average < 70 || r.average >= 80) return false
        } else if (scoreFilter === '60to69') {
          if (r.average === null || r.average < 60 || r.average >= 70) return false
        } else if (scoreFilter === 'lt60') {
          if (r.average === null || r.average >= 60) return false
        } else if (scoreFilter === 'null') {
          if (r.average !== null) return false
        }

        // Custom Min/Max range filter (evaluated against average or specific session)
        let evalScore = r.average
        if (targetSessionFilter !== 'all') {
          const sIdx = selected.findIndex((s) => s.id === targetSessionFilter)
          if (sIdx !== -1) {
            evalScore = r.scores[sIdx]
          }
        }

        if (minVal !== null && !isNaN(minVal)) {
          if (evalScore === null || evalScore < minVal) return false
        }
        if (maxVal !== null && !isNaN(maxVal)) {
          if (evalScore === null || evalScore > maxVal) return false
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
  }, [recap.rows, search, selectedProdi, scoreFilter, attendanceFilter, passFilter, minScore, maxScore, targetSessionFilter, sortField, sortOrder, selected])

  const isFiltered = useMemo(() => {
    return (
      Boolean(search.trim()) ||
      selectedProdi !== 'all' ||
      scoreFilter !== 'all' ||
      attendanceFilter !== 'all' ||
      passFilter !== 'all' ||
      minScore !== '' ||
      maxScore !== '' ||
      targetSessionFilter !== 'all' ||
      sortField !== 'name' ||
      sortOrder !== 'asc'
    )
  }, [search, selectedProdi, scoreFilter, attendanceFilter, passFilter, minScore, maxScore, targetSessionFilter, sortField, sortOrder])

  const resetAllFilters = () => {
    setSearch('')
    setSelectedProdi('all')
    setScoreFilter('all')
    setAttendanceFilter('all')
    setPassFilter('all')
    setMinScore('')
    setMaxScore('')
    setTargetSessionFilter('all')
    setSortField('name')
    setSortOrder('asc')
  }

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
      {/* Filter & Control Bar */}
      <div className="card border border-line bg-surface p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 pb-3">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-primary" />
            <h2 className="text-sm font-bold text-fg">Filter &amp; Pengurutan Data</h2>
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="btn btn-secondary text-xs py-1 px-2.5 h-auto text-primary hover:bg-primary-soft transition-colors"
            >
              ✕ Reset Semua Filter
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* 1. Search */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-search" className="text-xs font-bold text-secondary">
              Pencarian
            </label>
            <div className="relative">
              <input
                id="filter-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau NIM..."
                className="field text-sm w-full pl-8 py-2"
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
          </div>

          {/* 2. Program Studi */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-prodi" className="text-xs font-bold text-secondary">
              Program Studi
            </label>
            <select
              id="filter-prodi"
              value={selectedProdi}
              onChange={(e) => setSelectedProdi(e.target.value)}
              className="field text-sm py-2"
            >
              <option value="all">Semua Program Studi ({recap.rows.length})</option>
              {prodiOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="empty">Tanpa Prodi / Belum Diisi</option>
            </select>
          </div>

          {/* 3. Kelulusan (Kriteria >= 70) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-pass" className="text-xs font-bold text-secondary">
              Status Kelulusan (SKM 70)
            </label>
            <select
              id="filter-pass"
              value={passFilter}
              onChange={(e) => setPassFilter(e.target.value as PassFilter)}
              className="field text-sm py-2"
            >
              <option value="all">Semua Kelulusan</option>
              <option value="passed">Lulus (Rata-rata ≥ 70)</option>
              <option value="failed">Belum Lulus (&lt; 70 / Kosong)</option>
            </select>
          </div>

          {/* 4. Kehadiran Sesi */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-attendance" className="text-xs font-bold text-secondary">
              Kehadiran Sesi
            </label>
            <select
              id="filter-attendance"
              value={attendanceFilter}
              onChange={(e) => setAttendanceFilter(e.target.value as AttendanceFilter)}
              className="field text-sm py-2"
            >
              <option value="all">Semua Kehadiran</option>
              <option value="full">Lengkap ({selected.length} sesi)</option>
              <option value="partial">Sebagian Sesi</option>
              <option value="none">Belum Ikut Sesi (0)</option>
            </select>
          </div>

          {/* 5. Kategori Rentang Nilai */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-score-tier" className="text-xs font-bold text-secondary">
              Kategori Nilai Rata-rata
            </label>
            <select
              id="filter-score-tier"
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value as ScoreTierFilter)}
              className="field text-sm py-2"
            >
              <option value="all">Semua Kategori Nilai</option>
              <option value="ge80">≥ 80 (Sangat Baik / A)</option>
              <option value="70to79">70 – 79 (Baik / B)</option>
              <option value="60to69">60 – 69 (Cukup / C)</option>
              <option value="lt60">&lt; 60 (Perlu Remedial / D-E)</option>
              <option value="null">Belum Mengikuti Ujian</option>
            </select>
          </div>

          {/* 6. Urutan Data */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-sort" className="text-xs font-bold text-secondary">
              Urutan Tampilan
            </label>
            <select
              id="filter-sort"
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [f, o] = e.target.value.split('-')
                setSortField(f as SortField)
                setSortOrder(o as SortOrder)
              }}
              className="field text-sm py-2"
            >
              <option value="name-asc">Nama (A → Z)</option>
              <option value="name-desc">Nama (Z → A)</option>
              <option value="nim-asc">NIM (Terkecil → Terbesar)</option>
              <option value="nim-desc">NIM (Terbesar → Terkecil)</option>
              <option value="average-desc">Nilai Rata-rata (Tertinggi)</option>
              <option value="average-asc">Nilai Rata-rata (Terendah)</option>
              <option value="attended-desc">Kehadiran (Terbanyak)</option>
              <option value="attended-asc">Kehadiran (Tersedikit)</option>
              {selected.map((s) => (
                <option key={s.id} value={`session_${s.id}-desc`}>
                  Nilai {s.title} (Tertinggi)
                </option>
              ))}
            </select>
          </div>

          {/* 7. Rentang Nilai Kustom (Min - Max) */}
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <label className="text-xs font-bold text-secondary">
              Batas Nilai Kustom ({targetSessionFilter === 'all' ? 'Rata-rata' : 'Sesi Terpilih'})
            </label>
            <div className="flex items-center gap-2">
              <select
                value={targetSessionFilter}
                onChange={(e) => setTargetSessionFilter(e.target.value)}
                className="field text-xs py-2 w-32 shrink-0"
                title="Pilih acuan nilai"
              >
                <option value="all">Rata-rata</option>
                {selected.map((s, idx) => (
                  <option key={s.id} value={s.id}>
                    Sesi {idx + 1}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                placeholder="Min (0)"
                className="field text-sm py-2 w-full min-w-0 tabular-nums"
              />
              <span className="text-muted text-xs font-bold">–</span>
              <input
                type="number"
                min={0}
                max={100}
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                placeholder="Max (100)"
                className="field text-sm py-2 w-full min-w-0 tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Bottom bar summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted">Hasil filter:</span>
            <span className="badge bg-subtle font-bold text-fg px-2.5 py-0.5">
              {filteredRows.length} dari {recap.rows.length} peserta
            </span>
            {filteredRows.length < recap.rows.length && (
              <span className="text-muted hidden sm:inline">
                ({recap.rows.length - filteredRows.length} tersembunyi)
              </span>
            )}
          </div>
          <div className="text-muted text-[11px]">
            Tips: Klik tajuk kolom tabel di bawah untuk menyortir secara cepat.
          </div>
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
