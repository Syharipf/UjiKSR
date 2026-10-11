'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Brand from '@/app/brand'
import { Chevron, Lock, Megaphone } from '@/app/icons'
import Prinsip, { PRINSIP } from '@/app/prinsip'
import Notice from '@/app/notice'
import { PendingLabel } from '@/app/pending'
import ThemeToggle from '@/app/theme-toggle'
import { clock, GRACE_MS, LOBBY_POLL_MS, type ExamView, type PublicQuestion } from '@/lib/exam'
import { enterFullscreen, exitFullscreen, isFullscreen, subscribeFullscreen } from '@/lib/fullscreen'
import Confetti from './confetti'
import { useAntiCheat } from './use-anti-cheat'
import ParticipantFeedbackForm from './feedback-form'
import { playFinishSound, triggerViolationVibration } from './sound'

type ApiError = Error & { status?: number }

async function call(path: string, body?: object): Promise<ExamView> {
  const res = await fetch(
    path,
    body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' },
  ).catch(() => {
    throw new Error('Koneksi bermasalah, coba lagi')
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Terjadi kesalahan, coba lagi'), { status: res.status })
  return data
}

// Drop the "resume" pointer for this attempt. After a submit, keep a `result:<code>` pointer
// so the join page can link back here to show the score once it is released.
function forget(id: string, submitted = false) {
  try {
    for (const key of Object.keys(localStorage)) {
      if (localStorage.getItem(key) !== id) continue
      if (key.startsWith('attempt:')) {
        localStorage.removeItem(key)
        if (submitted) localStorage.setItem(`result:${key.slice('attempt:'.length)}`, id)
      } else if (key.startsWith('result:') && !submitted) localStorage.removeItem(key)
    }
  } catch {}
}

const RESULT_POLL_MS = 3_000
const RESULT_RETRY_MS = 2_000

// While waiting for scores: poll every RESULT_POLL_MS, but once the release moment is closer than
// that, wake exactly at it so every participant's score appears at the same time.
function nextResultCheck(untilRelease: number | null) {
  if (untilRelease === null || untilRelease > RESULT_POLL_MS) return RESULT_POLL_MS
  if (untilRelease > 0) return untilRelease
  return RESULT_RETRY_MS
}

// Submitted but score not released yet: check back until it is (re-armed after every check, even a
// failed one), waking exactly at the shared release moment when it is near.
function useResultChecks(view: ExamView | null, offset: number, refresh: () => Promise<unknown>) {
  const [checks, setChecks] = useState(0)
  const waiting = view?.status === 'submitted' && view.score === undefined
  const resultsAt = view?.results_at ?? null
  useEffect(() => {
    if (!waiting) return
    const delay = nextResultCheck(resultsAt === null ? null : resultsAt - (Date.now() + offset))
    const t = setTimeout(() => refresh().finally(() => setChecks((n) => n + 1)), delay)
    return () => clearTimeout(t)
  }, [waiting, resultsAt, offset, refresh, checks])
}

// Lobby: check every LOBBY_POLL_MS (spread out a little so a full room doesn't ask at once) until the
// start time is known, then wake exactly at it so everyone's questions appear together. Re-armed after
// every check, even a failed one.
function useStartChecks(view: ExamView | null, offset: number, refresh: () => Promise<unknown>) {
  const [checks, setChecks] = useState(0)
  const waiting = view?.status === 'waiting'
  const startsAt = view?.starts_at ?? null

  useEffect(() => {
    if (!waiting) return
    // If startsAt has arrived or passed, poll aggressively (every 1.5s) until questions load.
    // If startsAt is still in future, wait until that exact instant.
    // If startsAt is null (session not started yet), poll every ~2s.
    const nowServer = Date.now() + offset
    let delay: number
    if (startsAt === null) {
      delay = LOBBY_POLL_MS + Math.random() * 1000
    } else if (nowServer >= startsAt) {
      delay = 1500
    } else {
      delay = Math.max(0, startsAt - nowServer)
    }

    const t = setTimeout(() => refresh().finally(() => setChecks((n) => n + 1)), delay)
    return () => clearTimeout(t)
  }, [waiting, startsAt, offset, refresh, checks])
}

export default function ExamClient({ id }: { id: string }) {
  const base = `/api/attempts/${id}`
  const [view, setView] = useState<ExamView | null>(null)
  const [offset, setOffset] = useState(0) // server clock − device clock
  const [fatal, setFatal] = useState<ApiError | null>(null)
  const [notice, setNotice] = useState('')
  const [warning, setWarning] = useState('')
  const [picked, setPicked] = useState<{ id: string; choice: number } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cur, setCur] = useState(0) // total mode: the question on screen
  const [navOpen, setNavOpen] = useState(false) // total mode: the question list
  const fullscreen = useSyncExternalStore(subscribeFullscreen, isFullscreen, () => true)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const pending = useRef(0)

  const apply = useCallback((v: ExamView) => {
    setView(v)
    setOffset(v.server_now - Date.now())
  }, [])

  const onError = useCallback((e: ApiError) => {
    if (e.status === 404) {
      forget(id)
      exitFullscreen()
      setFatal(e)
    } else setNotice(e.message)
  }, [id])

  const refresh = useCallback(
    () =>
      call(base).then(apply, (e: ApiError) => {
        onError(e)
      }),
    [base, apply, onError],
  )

  const lastViolationRef = useRef(0)
  const reportViolation = useCallback(
    (type: string) => {
      const now = Date.now()
      if (now - lastViolationRef.current < 2000) return
      lastViolationRef.current = now
      triggerViolationVibration()
      setWarning('Jangan membuka aplikasi lain, notifikasi, overlay, atau asisten.')
      call(`${base}/violation`, { type }).then(
        (v) => {
          apply(v)
          if (v.status === 'active') {
            setWarning((prev) =>
              prev
                ? v.max_violations < 999
                  ? `Jangan membuka aplikasi lain, notifikasi, overlay, atau asisten. ` +
                    `Pada pelanggaran ke-${v.max_violations}, jawabanmu otomatis dikumpulkan.`
                  : 'Jangan membuka aplikasi lain, notifikasi, overlay, atau asisten. Pelanggaran dicatat oleh sistem.'
                : '',
            )
          } else if (v.status === 'submitted') {
            setWarning('')
          }
        },
        onError,
      )
    },
    [base, apply, onError],
  )

  // First load. Arriving without the "fresh" flag from the join page = reopened/reloaded → violation.
  useEffect(() => {
    let fresh = false
    try {
      fresh = sessionStorage.getItem(`fresh:${id}`) === '1'
    } catch {}
    let cancelled = false
    call(base).then(
      (v) => {
        if (cancelled) return
        try {
          sessionStorage.removeItem(`fresh:${id}`)
        } catch {}
        apply(v)
        if (!fresh && v.status === 'active') reportViolation('reopen')
      },
      (e) => {
        if (!cancelled) onError(e)
      },
    )
    return () => {
      cancelled = true
    }
  }, [id, base, apply, onError, reportViolation])

  const active = view?.status === 'active'
  useAntiCheat(active, reportViolation, active || view?.status === 'waiting')

  const deadline = view ? (view.question_deadline_at ?? view.deadline_at) : 0

  // When active, poll every 2.5s so when admin does "Paksa kumpul" (or closes session),
  // the participant's screen transitions to submitted immediately in real-time.
  // Also wakes up immediately when the deadline expires.
  useEffect(() => {
    if (!active) return
    const msUntilDeadline = Math.max(0, deadline - (Date.now() + offset)) + GRACE_MS + 500
    const delay = Math.min(2500, msUntilDeadline)
    const t = setTimeout(refresh, delay)
    return () => clearTimeout(t)
  }, [active, deadline, offset, view, refresh])
  useEffect(() => {
    if (view?.status !== 'submitted') return
    exitFullscreen()
    forget(id, true)
  }, [view, id])

  useResultChecks(view, offset, refresh)
  useStartChecks(view, offset, refresh)

  if (fatal)
    return (
      <Notice title="Ujian Telah Direset" body={fatal.message}>
        <div className="mt-4 flex flex-col gap-2">
          <Link href="/" className="btn btn-primary w-full">
            Kembali ke Halaman Masuk
          </Link>
        </div>
      </Notice>
    )
  if (!view) return <Notice title="Memuat ujian…" />
  if (view.status === 'submitted') return <Submitted id={id} view={view} offset={offset} />
  if (view.status === 'waiting') return <Waiting view={view} offset={offset} onRefresh={refresh} />

  // Answers and submit run one at a time so each response includes every earlier answer,
  // and a quick "Kumpulkan" never overtakes the last pick. Only the final response is applied,
  // otherwise an older response would briefly hide newer optimistic picks.
  function enqueue(task: () => Promise<ExamView>) {
    pending.current++
    const run = queue.current.then(task).then(
      (v) => {
        if (--pending.current === 0) apply(v)
      },
      (e: ApiError) => {
        pending.current--
        onError(e)
        if (e.status !== 404) {
          refresh()
        }
      },
    )
    queue.current = run
    return run
  }

  function answerTotal(questionId: string, choice: number) {
    setNotice('')
    setView((v) => v && { ...v, answers: { ...v.answers, [questionId]: choice } })
    enqueue(() => call(`${base}/answer`, { question_id: questionId, choice }))
  }

  function answerCurrent(questionId: string, choice: number) {
    setNotice('')
    setBusy(true)
    enqueue(() => call(`${base}/answer`, { question_id: questionId, choice })).finally(() => setBusy(false))
  }

  function submit() {
    setBusy(true)
    enqueue(() => call(`${base}/submit`, {})).finally(() => {
      setBusy(false)
      setConfirming(false)
    })
  }

  const perQuestion = view.timer_mode === 'per_question'
  const current = perQuestion ? view.questions[0] : undefined
  const pickedChoice = current && picked?.id === current.id ? picked.choice : null
  const answered = Object.keys(view.answers).length
  const locked = warning !== '' || !fullscreen
  const index = Math.min(cur, Math.max(0, view.questions.length - 1))
  const shown = perQuestion ? current : view.questions[index]
  const isLast = index === view.total - 1

  return (
    <div className="no-select flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-t-[5px] border-t-band bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 pt-3 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-extrabold">{view.title}</p>
              <p className={`flex items-center gap-1.5 text-[0.8rem] ${view.violation_count ? 'font-semibold text-danger' : 'text-muted'}`}>
                <Megaphone size={14} />
                {view.max_violations < 999 ? (
                  <>Pelanggaran <b className={view.violation_count ? '' : 'text-fg'}>{view.violation_count}</b> dari {view.max_violations}</>
                ) : (
                  <>Pelanggaran <b className={view.violation_count ? '' : 'text-fg'}>{view.violation_count}</b> (hanya peringatan)</>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle compact />
              <div className="flex flex-col items-end">
                <Clock deadline={deadline} offset={offset} />
                {perQuestion && <span className="mt-0.5 text-[0.7rem] text-muted">waktu soal ini</span>}
              </div>
            </div>
          </div>
          {/* One segment per question: done (per question) or answered (total); the current one in red. */}
          <div aria-hidden className="flex gap-[3px]">
            {Array.from({ length: view.total }, (_, i) => {
              const done = perQuestion ? i < view.current_index : view.questions[i] ? view.questions[i].id in view.answers : false
              const now = perQuestion ? i === view.current_index : i === index
              return <span key={i} className={`h-[5px] min-w-0 flex-1 rounded-full transition-colors ${now ? 'bg-primary' : done ? 'bg-navy' : 'bg-line'}`} />
            })}
          </div>
          {!perQuestion && (
            <>
              <button
                type="button"
                onClick={() => setNavOpen((o) => !o)}
                aria-expanded={navOpen}
                className="flex h-11 items-center justify-between rounded-[10px] border-[1.5px] border-line bg-page px-3.5 text-sm font-bold"
              >
                Daftar soal
                <span className="flex items-center gap-2 font-semibold text-muted">
                  {answered} dari {view.total} terjawab
                  <Chevron dir="down" className={`transition-transform ${navOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {navOpen && (
                <div className="space-y-3 pb-1">
                  <div className="grid grid-cols-5 gap-2">
                    {view.questions.map((q, i) => {
                      const done = q.id in view.answers
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            setCur(i)
                            setNavOpen(false)
                          }}
                          aria-label={`Soal ${i + 1}, ${done ? 'terjawab' : 'belum dijawab'}`}
                          aria-current={i === index ? 'step' : undefined}
                          className={`h-11 rounded-[10px] border-2 font-extrabold ${done ? 'border-navy bg-navy text-on-navy' : 'border-line-strong bg-surface'} ${i === index ? 'border-primary!' : ''}`}
                        >
                          {i + 1}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-3.5 text-xs text-muted">
                      <span className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-navy" />Terjawab</span>
                      <span className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] border-[1.5px] border-line-strong" />Belum</span>
                    </div>
                    <button type="button" onClick={() => { setNavOpen(false); setConfirming(true) }} className="btn btn-secondary min-h-10 px-3 text-sm">
                      Kumpulkan jawaban
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {perQuestion && <QuestionTimer deadline={deadline} offset={offset} seconds={view.per_question_sec} />}
        <div className="border-b border-line" />
      </header>

      {notice && <p className="bg-warn-soft px-4 py-2 text-center text-sm">{notice}</p>}

      <main className="exam-content mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-5">
        {shown && (
          <section className="flex flex-1 flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-muted">
                Soal <b className="display text-xl text-fg">{(perQuestion ? view.current_index : index) + 1}</b> dari {view.total}
              </p>
              {perQuestion ? (
                <p className="flex items-center gap-1.5 text-[0.8rem] text-muted">
                  <Lock size={13} />
                  Tidak bisa kembali
                </p>
              ) : (
                <p className="text-[0.8rem] text-muted">Jawaban bisa diubah sampai dikumpulkan</p>
              )}
            </div>
            <QuestionCard
              q={shown}
              selected={perQuestion ? pickedChoice : (view.answers[shown.id] ?? null)}
              onPick={(choice) => (perQuestion ? setPicked({ id: shown.id, choice }) : answerTotal(shown.id, choice))}
            />

            {perQuestion ? (
              <button
                disabled={pickedChoice === null || busy}
                onClick={() => current && pickedChoice !== null && answerCurrent(current.id, pickedChoice)}
                aria-busy={busy}
                className="btn btn-primary mt-auto mb-6 h-14 w-full text-base shadow-sm"
              >
                <PendingLabel pending={busy}>{view.current_index + 1 === view.total ? 'Jawab & selesai' : 'Jawab & lanjut'}</PendingLabel>
              </button>
            ) : confirming ? (
              <div className="card mt-auto border-danger-line p-4">
                <p>
                  {answered} dari {view.total} soal terjawab. Kumpulkan sekarang? Jawaban tidak bisa diubah lagi.
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setConfirming(false)} className="btn btn-secondary flex-1">
                    Batal
                  </button>
                  <button disabled={busy} aria-busy={busy} onClick={submit} className="btn btn-primary flex-1">
                    <PendingLabel pending={busy}>Kumpulkan</PendingLabel>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-auto mb-6 grid grid-cols-2 gap-2.5">
                <button type="button" disabled={index === 0} onClick={() => setCur(index - 1)} className="btn btn-secondary h-14 text-base">
                  <Chevron dir="left" />
                  Sebelumnya
                </button>
                {isLast ? (
                  <button type="button" onClick={() => setConfirming(true)} className="btn btn-primary h-14 text-base">
                    Kumpulkan jawaban
                  </button>
                ) : (
                  <button type="button" onClick={() => setCur(index + 1)} className="btn btn-navy h-14 text-base">
                    Berikutnya
                    <Chevron dir="right" />
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      {locked && (
        <div role="alertdialog" aria-labelledby="lock-title" className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1527] p-7 text-[#eef2f8]">
          <div className="flex w-full max-w-sm flex-col gap-6 text-center">
            <span className="mx-auto flex size-28 items-center justify-center rounded-full bg-[#c8102e] shadow-[0_0_0_12px_rgb(200_16_46/0.22),0_0_0_26px_rgb(200_16_46/0.1)]">
              <Megaphone size={56} />
            </span>
            <div className="space-y-3">
              {warning && (
                <p data-violation-count className="font-bold text-[#ff7482]">
                  {view.violation_count
                    ? view.max_violations < 999
                      ? `Peringatan: pelanggaran ${view.violation_count} dari ${view.max_violations}`
                      : `Peringatan: pelanggaran ke-${view.violation_count}`
                    : 'Peringatan'}
                </p>
              )}
              <h2 id="lock-title" className="display text-[1.85rem] text-balance">
                {warning ? 'Kamu keluar dari layar ujian' : 'Layar ujian terkunci'}
              </h2>
              <p className="text-[#c9d3e3]">{warning || 'Ketuk tombol di bawah untuk kembali ke layar penuh dan melanjutkan ujian.'}</p>
            </div>
            {view.violation_count > 0 && view.max_violations < 999 && (
              <div aria-hidden className="flex justify-center gap-2">
                {Array.from({ length: view.max_violations }, (_, i) => (
                  <span key={i} className={`h-2 w-12 rounded ${i < view.violation_count ? 'bg-[#ff5a6a]' : 'bg-[#2a3d63]'}`} />
                ))}
              </div>
            )}
            <button
              onClick={async () => {
                await enterFullscreen()
                setWarning('')
              }}
              className="btn h-14 w-full bg-white text-base text-[#0f1a2e] hover:bg-[#eef2f8]"
            >
              Saya mengerti, lanjutkan
            </button>
            <p className="-mt-3 text-sm text-[#9aa8c1]">Waktu ujian tetap berjalan.</p>
          </div>
        </div>
      )}
    </div>
  )
}

const cheer = (score: number) => (score >= 80 ? 'Luar biasa' : score >= 60 ? 'Kerja bagus' : 'Terima kasih sudah berjuang')

// Ticks every 250 ms. Only the small clock components use it, so the question list doesn't
// re-render four times a second.
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  return now
}

function Clock({ deadline, offset }: Readonly<{ deadline: number; offset: number }>) {
  const remaining = Math.max(0, deadline - (useNow() + offset))
  return (
    <p role="timer" className={`display rounded-[10px] px-3 py-1 text-2xl tabular-nums ${remaining < 10_000 ? 'bg-danger-soft text-danger' : 'bg-subtle'}`}>
      {clock(remaining)}
    </p>
  )
}

// Per-question mode: a bar under the header that shortens as this question's time runs out.
function QuestionTimer({ deadline, offset, seconds }: Readonly<{ deadline: number; offset: number; seconds: number }>) {
  const left = Math.max(0, deadline - (useNow() + offset))
  return (
    <div aria-hidden className="h-1 bg-line">
      <div className="h-full bg-primary transition-[width] duration-300 ease-linear" style={{ width: `${Math.min(100, (100 * left) / (seconds * 1000))}%` }} />
    </div>
  )
}

// Countdown to the moment scores are released for everyone.
function ReleaseCountdown({ at, offset }: Readonly<{ at: number; offset: number }>) {
  const left = Math.max(0, at - (useNow() + offset))
  return (
    <>
      <p role="timer" className="display my-2 text-6xl tabular-nums text-primary">
        {clock(left)}
      </p>
      <p className="text-sm text-muted">{left ? 'Menunggu peserta lain menyelesaikan ujian. Biarkan halaman ini terbuka.' : 'Mengambil nilai…'}</p>
    </>
  )
}

// Lobby: the participant's card, so they can check their details while waiting for the start.
function Waiting({ view, offset, onRefresh }: Readonly<{ view: ExamView; offset: number; onRefresh?: () => void }>) {
  const [refreshing, setRefreshing] = useState(false)
  const left = Math.max(0, (view.starts_at ?? 0) - (useNow() + offset))
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-band text-on-band">
        <div className="mx-auto flex max-w-md flex-col gap-4 px-5 pt-5 pb-28">
          <div className="flex items-center justify-between gap-3">
            <Brand onBand subtitle={null} />
            <span className="text-sm text-on-band/85">Lobi ujian</span>
          </div>
          <Prinsip />
        </div>
      </header>
      <main className="mx-auto -mt-20 flex w-full max-w-md flex-1 flex-col items-center gap-6 px-6 pb-7">
        <article aria-label="Kartu peserta" className="w-full overflow-hidden rounded-[18px] bg-surface shadow-[0_2px_4px_rgb(15_26_46/0.08),0_18px_40px_-16px_rgb(15_26_46/0.35)]">
          <div className="flex flex-col items-center gap-3 bg-[#13294b] px-5 pt-4 pb-3.5 text-white">
            <span aria-hidden className="h-2.5 w-14 rounded-md bg-page" />
            <div className="flex w-full items-center justify-between text-sm">
              <span className="display text-sm">Kartu peserta</span>
              <span className="opacity-80">{view.kind === 'pre' ? 'Pre-test' : 'Post-test'}</span>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <p className="display text-[1.75rem]">{view.name}</p>
              {view.prodi && <p className="mt-1.5 text-muted">{view.prodi}</p>}
            </div>
            <dl>
              <dt className="text-xs text-muted">NIM</dt>
              <dd className="font-bold">{view.nim}</dd>
            </dl>
            <div className="border-t-2 border-dashed border-line" />
            <p className="text-sm font-bold">{view.title}</p>
          </div>
        </article>

        {view.starts_at === null ? (
          <>
            <p role="status" className="flex items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-bold">
              <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-ok motion-reduce:animate-none" />
              Menunggu panitia memulai ujian
            </p>
            <p className="max-w-xs text-center text-secondary">Soal muncul otomatis di sini. Biarkan halaman ini terbuka dan layar tetap menyala.</p>
            {onRefresh && (
              <button
                type="button"
                onClick={async () => {
                  setRefreshing(true)
                  try {
                    await onRefresh()
                  } finally {
                    setRefreshing(false)
                  }
                }}
                disabled={refreshing}
                className="text-xs text-primary underline hover:text-fg disabled:opacity-50"
              >
                {refreshing ? 'Memeriksa status...' : 'Pengawas sudah mulai? Periksa sekarang'}
              </button>
            )}
          </>
        ) : (
          <div className="text-center space-y-2">
            <p className="text-secondary">Ujian dimulai dalam</p>
            <p role="timer" className="display text-6xl tabular-nums text-primary">
              {clock(left)}
            </p>
            {left <= 0 && onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="btn btn-primary mt-2 text-sm"
              >
                Masuk ujian sekarang
              </button>
            )}
          </div>
        )}

        <section aria-labelledby="prinsip-title" className="mt-auto w-full space-y-2.5 text-center">
          <h2 id="prinsip-title" className="text-xs font-bold text-muted">
            Tujuh Prinsip Dasar Gerakan
          </h2>
          <ol className="flex flex-wrap justify-center gap-x-3.5 gap-y-1.5 text-sm font-semibold text-secondary">
            {PRINSIP.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  )
}

const duration = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
// Post-test feedback sits below the notice/score; a floating pill points to it until it is on screen or sent.
function FeedbackSection({ attemptId, sent, onSent }: Readonly<{ attemptId: string; sent: boolean; onSent: () => void }>) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (sent || !ref.current) return
    const observer = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '0px 0px -20% 0px' })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [sent])

  return (
    <>
      <div ref={ref} id="feedback" className="scroll-mt-4">
        <ParticipantFeedbackForm attemptId={attemptId} initialSubmitted={sent} onSuccess={onSent} />
      </div>
      {!sent && !inView && (
        <button
          type="button"
          onClick={() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="btn btn-primary fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full px-5 shadow-lg motion-safe:animate-bounce"
        >
          Isi feedback di bawah
          <Chevron dir="down" />
        </button>
      )}
    </>
  )
}

function Submitted({ id, view, offset }: Readonly<{ id: string; view: ExamView; offset: number }>) {
  const celebrate = view.submit_reason !== 'violation'
  const title = celebrate ? 'Selamat, kamu sudah selesai!' : 'Ujian dikumpulkan otomatis'
  const [feedbackSent, setFeedbackSent] = useState(view.feedback_sent ?? false)

  useEffect(() => {
    if (celebrate) {
      playFinishSound()
    }
  }, [celebrate])

  // Waiting for score release:
  if (view.score === undefined && view.results_at === null) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Notice
          fill={view.kind !== 'post'}
          title={title}
          body="Jawaban terkirim. Nilai akan muncul di halaman ini setelah panitia menutup sesi dan semua peserta selesai. Biarkan halaman ini terbuka, atau buka lagi QR/link ujian nanti."
        >
          {celebrate && <Confetti />}
        </Notice>
        {view.kind === 'post' && (
          <main className="mx-auto w-full max-w-md px-4.5 pb-24">
            <FeedbackSection attemptId={id} sent={feedbackSent} onSent={() => setFeedbackSent(true)} />
          </main>
        )}
      </div>
    )
  }
  if (view.score === undefined) {
    return (
      <div className="flex min-h-dvh flex-col">
        <Notice fill={view.kind !== 'post'} title={title} body="Jawaban terkirim. Nilai semua peserta muncul serentak dalam">
          {celebrate && <Confetti />}
          <ReleaseCountdown at={view.results_at ?? 0} offset={offset} />
        </Notice>
        {view.kind === 'post' && (
          <main className="mx-auto w-full max-w-md px-4.5 pb-24">
            <FeedbackSection attemptId={id} sent={feedbackSent} onSent={() => setFeedbackSent(true)} />
          </main>
        )}
      </div>
    )
  }
  const firstName = view.name.trim().split(/\s+/)[0]
  const pre = view.pre_score
  return (
    <div className="flex min-h-dvh flex-col">
      {celebrate && <Confetti key="score" /> /* new key: replay the burst when the score arrives */}
      <header className="bg-band text-on-band">
        <div className="mx-auto flex max-w-md flex-col gap-5 px-5 pt-5 pb-5">
          <div className="flex items-center justify-between gap-3">
            <Brand onBand subtitle={null} />
            <ThemeToggle compact onBand />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-on-band/90">{view.title}</p>
            <h1 className="display text-2xl">{celebrate ? `${cheer(view.score)}, ${firstName}!` : 'Ujian dikumpulkan otomatis'}</h1>
          </div>
          <div className="flex items-end gap-2.5">
            <p data-score className="pop-in display text-[7rem] leading-[0.85] tracking-[-0.04em]" aria-label={`Nilaimu ${view.score} dari 100`}>
              {view.score}
            </p>
            <div className="flex flex-col gap-0.5 pb-1.5">
              <span className="text-lg font-bold text-on-band/85">/100</span>
              <span className="text-sm text-on-band/85">Nilaimu</span>
            </div>
          </div>
          <Prinsip />
        </div>
      </header>

      <main className={`mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-4.5 pt-5 ${view.kind === 'post' ? 'pb-24' : 'pb-6'}`}>
        {view.kind === 'pre' ? (
          <section aria-labelledby="awal-title" className="card space-y-3 p-4">
            <h2 id="awal-title" className="display text-[0.95rem]">
              Ini titik awalmu
            </h2>
            <Bars rows={[{ label: 'Pre-test', value: view.score, tone: 'bg-navy' }, { label: 'Post-test', value: null }]} />
            <p className="text-sm text-muted">Kenaikan nilaimu muncul di sini setelah post-test materi ini, selama NIM yang dipakai sama.</p>
          </section>
        ) : pre !== undefined && pre !== null ? (
          <section aria-labelledby="banding-title" className="card space-y-3 p-4">
            <div className="flex items-baseline justify-between gap-2.5">
              <h2 id="banding-title" className="display text-[0.95rem]">
                Dibanding pre-test
              </h2>
              <Delta value={view.score - pre} />
            </div>
            <Bars
              rows={[
                { label: 'Pre-test', value: pre, tone: 'bg-navy' },
                { label: 'Post-test', value: view.score, tone: 'bg-primary' },
              ]}
            />
          </section>
        ) : pre === null ? (
          <section className="flex gap-3 rounded-2xl border-[1.5px] border-dashed border-line-strong bg-surface p-4 text-sm text-secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="mt-px shrink-0 text-muted">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
            <p>
              Nilai pre-test untuk NIM <b className="text-fg">{view.nim}</b> tidak ditemukan di materi ini, jadi perbandingan tidak ditampilkan. Kalau kamu ikut
              pre-test, tanyakan panitia apakah NIM-nya tercatat berbeda.
            </p>
          </section>
        ) : null}

        <dl className="grid grid-cols-3 gap-2.5">
          <Fact label="Jawaban benar">
            {view.correct ?? '–'}
            <span className="text-sm text-muted">/{view.total}</span>
          </Fact>
          <Fact label="Waktu dipakai">{view.time_used_ms !== undefined ? duration(view.time_used_ms) : '–'}</Fact>
          <Fact label="Pelanggaran">{view.violation_count}</Fact>
        </dl>
        {view.kind === 'post' && (
          <FeedbackSection attemptId={id} sent={feedbackSent} onSent={() => setFeedbackSent(true)} />
        )}

        <div className="flex justify-between gap-3 px-1 pt-1 text-sm text-muted">
          <span className="min-w-0 truncate">{view.name}</span>
          <span className="shrink-0">NIM {view.nim}</span>
        </div>

        <Link href="/" className="btn btn-secondary mt-auto h-13 w-full text-base">
          Kembali ke beranda
        </Link>
      </main>
    </div>
  )
}

function Fact({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="flex flex-col-reverse rounded-[14px] border border-line bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="display text-[1.4rem]">{children}</dd>
    </div>
  )
}

function Delta({ value }: Readonly<{ value: number }>) {
  const tone = value > 0 ? 'bg-ok-soft text-ok' : value < 0 ? 'bg-danger-soft text-danger' : 'bg-subtle text-secondary'
  const text = value > 0 ? `naik ${value} poin` : value < 0 ? `turun ${-value} poin` : 'sama'
  return <span className={`rounded-full px-2.5 py-1 text-sm font-extrabold ${tone}`}>{text}</span>
}

function Bars({ rows }: Readonly<{ rows: { label: string; value: number | null; tone?: string }[] }>) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_2rem] items-center gap-x-2.5 gap-y-2 text-[0.8rem]">
      {rows.map((r) => (
        <Fragment key={r.label}>
          <span className="text-muted">{r.label}</span>
          {r.value === null ? (
            <span aria-hidden className="h-2.5 rounded-full border-[1.5px] border-dashed border-line-strong" />
          ) : (
            <span aria-hidden className="h-2.5 rounded-full bg-track">
              <span className={`block h-full rounded-full ${r.tone}`} style={{ width: `${r.value}%` }} />
            </span>
          )}
          <b className={`text-right ${r.value === null ? 'text-muted' : ''}`}>{r.value ?? '?'}</b>
        </Fragment>
      ))}
    </div>
  )
}

function QuestionCard({ q, selected, onPick }: { q: PublicQuestion; selected: number | null; onPick: (choice: number) => void }) {
  return (
    <div className="space-y-4">
      <p data-question className="whitespace-pre-line text-[1.2rem] leading-snug font-semibold">{q.text}</p>
      <div role="group" aria-label="Pilihan jawaban" className="grid gap-2.5">
        {q.options.map((option, i) => {
          const on = selected === i
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(i)}
              className={`flex min-h-14 min-w-0 items-center gap-3.5 rounded-[14px] border-2 px-3.5 py-2.5 text-left transition-colors ${
                on ? 'border-navy bg-navy-soft font-bold' : 'border-line bg-surface hover:border-line-strong'
              }`}
            >
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] text-sm font-extrabold ${on ? 'bg-navy text-on-navy' : 'bg-subtle text-secondary'}`}>
                {q.type === 'mc' ? String.fromCodePoint(65 + i) : i === 0 ? 'B' : 'S'}
              </span>
              <span className="min-w-0">{option}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
