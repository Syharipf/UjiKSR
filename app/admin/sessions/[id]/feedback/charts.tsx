'use client'

import { useState } from 'react'

export interface ChartDistribution {
  title: string
  subtitle: string
  totalVotes: number
  counts: Record<number, number> // 5 down to 1
  maxScale: number
  participants?: Record<number, { name: string; nim: string }[]>
}

export default function FeedbackCharts({
  charts,
}: Readonly<{
  charts: [ChartDistribution, ChartDistribution, ChartDistribution]
}>) {
  const [openItem, setOpenItem] = useState<string | null>(null)
  return (
    <section aria-labelledby="charts-heading" className="card space-y-5 p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id="charts-heading" className="display text-lg font-bold text-fg">
          Sebaran Skor Penilaian (Skala 1–5)
        </h2>
        <p className="text-xs text-muted">
          Perbandingan sebaran nilai keseluruhan pertemuan, pemahaman materi, dan ruangan dengan skala sumbu yang seragam.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line pt-2">
        {charts.map((chart, idx) => (
          <div key={idx} className={`space-y-3 ${idx > 0 ? 'pt-5 md:pt-0 md:pl-6' : ''}`}>
            <div>
              <h3 className="font-bold text-sm text-fg">{chart.title}</h3>
              <p className="text-xs text-muted">
                {chart.subtitle} ({chart.totalVotes} responden)
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {[5, 4, 3, 2, 1].map((score) => {
                const count = chart.counts[score] || 0
                const percent = chart.maxScale > 0 ? Math.round((count / chart.maxScale) * 100) : 0
                const key = `${idx}-${score}`
                const isOpen = openItem === key
                const parts = chart.participants?.[score] ?? []
                const hasParts = parts.length > 0
                return (
                  <div key={score} className="space-y-1">
                    <button
                      type="button"
                      disabled={!hasParts}
                      onClick={() => setOpenItem(isOpen ? null : key)}
                      className={`w-full grid grid-cols-[1.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs rounded p-1 transition-colors ${
                        hasParts ? 'cursor-pointer hover:bg-subtle/50' : 'cursor-default'
                      }`}
                    >
                      <span className="font-bold text-secondary text-right">{score}</span>
                      <div className="h-3 w-full overflow-hidden rounded bg-track">
                        <div
                          className="h-full rounded bg-navy transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="font-mono text-muted text-right flex items-center justify-end gap-1">
                        <span>{count}</span>
                        {hasParts && <span className="text-[0.65rem] opacity-60">{isOpen ? '▲' : '▼'}</span>}
                      </span>
                    </button>
                    {isOpen && hasParts && (
                      <div className="rounded-lg border border-line bg-subtle/40 p-2 text-xs space-y-1 animate-in">
                        <p className="font-semibold text-muted text-[0.7rem] px-0.5">Peserta ({parts.length}):</p>
                        <div className="max-h-36 overflow-y-auto space-y-0.5 pr-1">
                          {parts.map((p, pIdx) => (
                            <div key={`${p.nim}-${pIdx}`} className="flex items-center justify-between text-secondary py-0.5 px-1 rounded hover:bg-surface text-[0.75rem]">
                              <span className="truncate font-medium text-fg">{p.name}</span>
                              <span className="font-mono text-muted text-[0.7rem] shrink-0">({p.nim})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
