'use client'

import type { ScoreDistribution } from '@/lib/report'

const TIER_COLORS: Record<string, { bar: string; text: string }> = {
  // Theme tokens (globals.css), not Tailwind's dark: variant, which follows only the device setting and
  // would ignore the in-app theme toggle.
  '90–100': { bar: 'bg-tier-1', text: 'text-tier-1' },
  '80–89': { bar: 'bg-tier-2', text: 'text-tier-2' },
  '70–79': { bar: 'bg-tier-3', text: 'text-tier-3' },
  '60–69': { bar: 'bg-tier-4', text: 'text-warn' },
  '< 60': { bar: 'bg-tier-5', text: 'text-danger' },
}

export default function SessionCharts({
  distribution,
  totalAttempts,
  workingCount,
  submittedCount,
}: Readonly<{
  distribution: ScoreDistribution
  totalAttempts: number
  workingCount: number
  submittedCount: number
}>) {
  if (totalAttempts === 0) return null

  const maxTierCount = Math.max(1, ...distribution.tiers.map((t) => t.count))
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const passRate = distribution.passRate ?? 0
  const passStroke = (passRate / 100) * circumference
  const failStroke = circumference - passStroke

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px]">
      {/* 1. Bar Chart: Distribusi Nilai */}
      <div className="card space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="display text-base">Distribusi nilai peserta</h3>
            <p className="text-xs text-muted">Sebaran nilai dari {distribution.totalGraded} peserta yang sudah dinilai</p>
          </div>
          {distribution.totalGraded > 0 && (
            <span className="badge bg-subtle text-xs text-secondary">
              Total {distribution.totalGraded} nilai
            </span>
          )}
        </div>

        {distribution.totalGraded === 0 ? (
          <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Belum ada nilai terkumpul. Grafik distribusi akan muncul otomatis begitu peserta selesai mengerjakan.
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {distribution.tiers.map((tier) => {
              const color = TIER_COLORS[tier.range] ?? { bar: 'bg-primary', text: 'text-primary' }
              const widthPct = Math.round((tier.count / maxTierCount) * 100)
              return (
                <div key={tier.range} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">
                      {tier.range}{' '}
                      <span className="font-normal text-muted">({tier.label})</span>
                    </span>
                    <span className="text-muted">
                      <b className={`font-semibold ${tier.count > 0 ? color.text : 'text-fg'}`}>{tier.count}</b> orang{' '}
                      ({tier.percentage}%)
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-subtle">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
                      style={{ width: `${tier.count > 0 ? Math.max(4, widthPct) : 0}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. Donut & Progress Chart: Kelulusan & Status */}
      <div className="card flex flex-col justify-between space-y-4 p-4 sm:p-5">
        <div>
          <h3 className="display text-base">Kelulusan dan progres</h3>
          <p className="text-xs text-muted">Batas kelulusan standar KKM 70</p>
        </div>

        {/* Donut Kelulusan */}
        <div className="flex items-center justify-center gap-5 py-2">
          {distribution.totalGraded === 0 ? (
            <div className="size-28 flex items-center justify-center rounded-full border-4 border-dashed border-line text-xs text-muted text-center p-2">
              Menunggu peserta
            </div>
          ) : (
            <div className="relative size-28 shrink-0">
              <svg className="size-full -rotate-90" viewBox="0 0 100 100" aria-label="Diagram Kelulusan">
                {/* Background ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="stroke-subtle"
                  strokeWidth="12"
                  fill="none"
                />
                {/* Failed arc */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="stroke-tier-5"
                  strokeWidth="12"
                  strokeDasharray={`${failStroke} ${circumference}`}
                  strokeDashoffset={-passStroke}
                  fill="none"
                  strokeLinecap="round"
                />
                {/* Passed arc */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="stroke-tier-1"
                  strokeWidth="12"
                  strokeDasharray={`${passStroke} ${circumference}`}
                  strokeDashoffset="0"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold text-fg">{distribution.passRate ?? 0}%</span>
                <span className="text-xs font-semibold text-muted">lulus</span>
              </div>
            </div>
          )}

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-tier-1 shrink-0" />
              <div>
                <p className="font-semibold text-fg">Lulus (&ge; 70)</p>
                <p className="text-muted">{distribution.passedCount} peserta</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-tier-5 shrink-0" />
              <div>
                <p className="font-semibold text-fg">Belum (&lt; 70)</p>
                <p className="text-muted">{distribution.failedCount} peserta</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Pengerjaan */}
        <div className="border-t border-line pt-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Progres peserta</span>
            <span>{submittedCount} / {totalAttempts} selesai</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-subtle">
            <div
              className="bg-ok transition-all"
              style={{ width: `${totalAttempts > 0 ? (submittedCount / totalAttempts) * 100 : 0}%` }}
              title={`Selesai: ${submittedCount}`}
            />
            <div
              className="bg-tier-4 transition-all"
              style={{ width: `${totalAttempts > 0 ? (workingCount / totalAttempts) * 100 : 0}%` }}
              title={`Sedang Mengerjakan: ${workingCount}`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-ok" /> Selesai ({submittedCount})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-tier-4" /> Mengerjakan ({workingCount})
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
