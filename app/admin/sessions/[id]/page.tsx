import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { requireAdmin } from '@/lib/admin-auth'
import { finalizeExpired, resultsStatus, UUID } from '@/lib/attempts'
import { db, must } from '@/lib/db'
import { formatDate, hasStarted, isOpen, type Attempt, type Question, type ResultsStatus, type Session } from '@/lib/exam'
import { calculateQuestionAccuracy, calculateScoreDistribution, calculateSessionStats } from '@/lib/report'
import { deleteQuestion, deleteSession, duplicateSession, forceSubmitAll, resetAllAttempts, saveQuestion, setOpen, startExam, updateSession, uploadQuestions } from '../../actions'
import LinkPending from '@/app/link-pending'
import ParticipantsTable from './participants-table'
import SessionCharts from './session-charts'
import SubmitButton from '@/app/submit-button'
import QuestionUploader from './question-uploader'
import QuestionForm from '../../question-form'
import SessionForm, { type PreOption } from '../../session-form'
import { AutoRefresh, Countdown } from './live'


const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' })

// Participants see their score only once resultsStatus() releases it: session closed and nobody still
// working. Until then a countdown runs to the last participant's deadline.
function ScoreStatus({ results, working, serverNow }: Readonly<{ results: ResultsStatus; working: number; serverNow: number }>) {
  if (results.released) return <>Nilai sudah terlihat oleh peserta di HP masing-masing.</>
  if (results.at === null) return <>Nilai belum terlihat peserta. Nilai muncul serentak setelah sesi ditutup dan semua peserta selesai.</>
  return (
    <>
      Nilai belum terlihat peserta{working > 0 && <>: {working} peserta masih mengerjakan</>}. Nilai muncul serentak dalam{' '}
      <Countdown until={results.at} serverNow={serverNow} /> (pukul {time(new Date(results.at).toISOString())} WIB).
    </>
  )
}

type Violation = { id: string; attempt_id: string; type: string; created_at: string }

export default async function SessionAdminPage(props: PageProps<'/admin/sessions/[id]'>) {
  await requireAdmin()
  const { id } = await props.params
  const { msg } = await props.searchParams
  if (!UUID.test(id)) notFound()
  const session: Session | null = must(await db().from('exam_sessions').select('*').eq('id', id).maybeSingle())
  if (!session) notFound()

  await finalizeExpired(id)
  const [questions, attempts, violations, results, preSessions, feedbacks] = await Promise.all([
    db().from('questions').select('*').eq('session_id', id).order('position').then(must) as Promise<Question[]>,
    db().from('attempts').select('*').eq('session_id', id).order('started_at').order('name').then(must) as Promise<Attempt[]>,
    db()
      .from('violations')
      .select('id, attempt_id, type, created_at, attempts!inner(session_id)')
      .eq('attempts.session_id', id)
      .order('created_at')
      .then(must) as Promise<Violation[]>,
    resultsStatus(session),
    db().from('exam_sessions').select('id, title, held_on, code').eq('kind', 'pre').order('held_on', { ascending: false }).then(must) as Promise<PreOption[]>,
    // Tolerant query for feedbacks (if session is post-test)
    (async () => {
      if (session.kind !== 'post') return []
      try {
        const rows = (await db().from('feedbacks').select('*, attempts(name, nim, prodi, score)').eq('session_id', id).order('created_at', { ascending: false })).data || []
        return rows.map((r: Record<string, unknown>) => {
          const attempt = (r.attempts && typeof r.attempts === 'object' ? r.attempts : {}) as Record<string, unknown>
          return {
            id: String(r.id),
            attempt_id: String(r.attempt_id),
            name: typeof attempt.name === 'string' ? attempt.name : 'Peserta',
            nim: typeof attempt.nim === 'string' ? attempt.nim : '-',
            prodi: typeof attempt.prodi === 'string' ? attempt.prodi : '',
            score: typeof attempt.score === 'number' ? attempt.score : null,
            rating: Number(r.rating) || 5,
            clarity: typeof r.clarity === 'number' ? r.clarity : null,
            difficulty: typeof r.difficulty === 'string' ? r.difficulty : null,
            comment: typeof r.comment === 'string' ? r.comment : null,
            created_at: String(r.created_at),
          }
        })
      } catch {
        return []
      }
    })(),
  ])
  const sessionsById = new Map(preSessions.map((p) => [p.id, p]))
  const preOptions = preSessions.filter((p) => p.id !== id)
  const locked = attempts.length > 0 || session.started_at !== null
  const working = attempts.filter((a) => !a.submitted_at).length
  // eslint-disable-next-line react-hooks/purity -- server component, rendered once per request
  const serverNow = Date.now()
  const open = isOpen(session, serverNow)
  const lobby = open && !session.started_at
  const started = hasStarted(session, serverNow)
  const stats = calculateSessionStats(attempts)
  const accuracy = calculateQuestionAccuracy(questions, attempts)
  const distribution = calculateScoreDistribution(attempts)
  const h = await headers()
  const link = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}/s/${session.code}`
  const qr = await QRCode.toDataURL(link, { width: 480, margin: 1 })

  const pair = session.kind === 'post' && session.pre_session_id ? sessionsById.get(session.pre_session_id) : undefined
  const hardest = questions
    .map((q, i) => ({ q, i, stat: accuracy.get(q.id) }))
    .filter((x) => x.stat && x.stat.percentage !== null)
    .sort((a, b) => a.stat!.percentage! - b.stat!.percentage!)
    .slice(0, 5)

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 pt-6 pb-14 sm:px-6">
      <header className="space-y-2.5">
        <Link href="/admin" className="text-sm font-bold text-muted hover:text-fg">
          ← Semua sesi <LinkPending />
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 space-y-2.5">
            <h1 className="display text-[2.1rem]">{session.title}</h1>
            <div className="flex flex-wrap gap-2 text-[0.8rem] font-bold">
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${open ? 'bg-ok-soft text-ok' : 'bg-subtle text-muted'}`}>
                <span aria-hidden className={`size-2 rounded-full ${open ? 'bg-ok' : 'bg-muted'}`} />
                {lobby ? 'Lobi' : open ? 'Berjalan' : 'Ditutup'}
              </span>
              <span className="rounded-full bg-subtle px-2.5 py-1 text-secondary">{session.kind === 'pre' ? 'Pre-test' : 'Post-test'}</span>
              <span className="rounded-full bg-subtle px-2.5 py-1 text-secondary">{formatDate(session.held_on)}</span>
              <span className="rounded-full bg-subtle px-2.5 py-1 text-secondary">kode {session.code}</span>
              {pair && (
                <Link href={`/admin/sessions/${pair.id}`} className="rounded-full bg-navy-soft px-2.5 py-1 text-navy hover:underline">
                  Pasangan: {pair.title}
                </Link>
              )}
            </div>
          </div>
          <form action={duplicateSession.bind(null, id)}>
            <SubmitButton confirm="Duplikat sesi ini beserta seluruh soalnya?" className="btn btn-secondary text-sm">
              Duplikat sesi
            </SubmitButton>
          </form>
        </div>
        {session.kind === 'post' && (
          <div className="flex border-b border-line text-sm font-semibold pt-2">
            <div className="border-b-2 border-primary px-4 py-2.5 text-primary">
              Sesi &amp; peserta
            </div>
            <Link
              href={`/admin/sessions/${id}/feedback`}
              className="border-b-2 border-transparent px-4 py-2.5 text-secondary hover:text-fg transition-colors flex items-center gap-1.5"
            >
              <span>Feedback</span>
              <span className="badge bg-primary/10 text-primary text-xs px-2 py-0.2 rounded-full">
                {feedbacks.length}
              </span>
              <LinkPending />
            </Link>
          </div>
        )}
      </header>

      {/* Joins, answers, violations and the score release only happen while someone can still work. */}
      {(open || working > 0 || results.at !== null) && <AutoRefresh />}
      {msg && <output className="block rounded-xl bg-warn-soft p-3 text-sm font-medium">{msg}</output>}

      <div className="flex flex-wrap gap-4">
        <section aria-labelledby="kontrol" className="card flex min-w-0 flex-[1_1_380px] flex-col gap-4 p-5">
          <h2 id="kontrol" className="display text-base">
            Kontrol sesi
          </h2>
          <div className="flex items-center gap-5">
            <div className="min-w-0 flex-1">
              {open && session.started_at && !started ? (
                <>
                  <p className="text-sm text-muted">Soal muncul di HP peserta dalam</p>
                  <Countdown until={Date.parse(session.started_at)} serverNow={serverNow} className="display block text-5xl" />
                </>
              ) : open && session.closes_at ? (
                <>
                  <p className="text-sm text-muted">Ujian berakhir dalam</p>
                  <Countdown until={Date.parse(session.closes_at)} serverNow={serverNow} className="display block text-5xl" />
                  <p className="mt-1.5 text-sm text-muted">Pukul {time(session.closes_at)} WIB, sama untuk semua peserta.</p>
                </>
              ) : lobby ? (
                <>
                  <p className="display text-5xl">{attempts.length}</p>
                  <p className="mt-1.5 text-sm text-muted">peserta menunggu di lobi</p>
                </>
              ) : (
                <p className="display text-3xl text-muted">Sesi ditutup</p>
              )}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimize */}
            <img src={qr} alt={`QR ${link}`} className="size-28 shrink-0 rounded-xl bg-white p-1.5 ring-1 ring-line" />
          </div>
          <p className="rounded-[10px] bg-subtle px-3 py-2 font-mono text-[0.8rem] break-all text-secondary">{link}</p>
          <p className={`font-semibold ${open ? 'text-ok' : 'text-muted'}`}>
            {lobby
              ? `Lobi dibuka — ${attempts.length} peserta menunggu. Klik "Mulai ujian" saat semua sudah masuk.`
              : open
                ? 'Ujian berjalan — peserta yang telat masih bisa masuk dengan sisa waktu.'
                : session.is_open
                  ? 'Sesi ditutup otomatis — waktu ujian sudah habis.'
                  : 'Sesi ditutup — peserta belum bisa masuk.'}
          </p>
          <p className="text-sm text-muted">
            <ScoreStatus results={results} working={working} serverNow={serverNow} />
          </p>
          <div className="flex flex-wrap gap-2">
            {lobby && (
              <form action={startExam.bind(null, id)}>
                <SubmitButton confirm={`Mulai ujian untuk ${attempts.length} peserta? Waktu semua peserta mulai berjalan bersamaan.`} className="btn btn-primary">
                  Mulai ujian
                </SubmitButton>
              </form>
            )}
            <a href={`/admin/sessions/${id}/qr`} target="_blank" className="btn btn-navy">
              Tayangkan QR &amp; kode
            </a>
            {session.kind === 'post' && (
              <a href={`/admin/sessions/${id}/feedback-qr`} target="_blank" className="btn btn-secondary">
                Tayangkan QR Feedback
              </a>
            )}
            <form action={setOpen.bind(null, id, !open)}>
              <SubmitButton className={`btn ${open ? 'btn-secondary' : 'btn-primary'}`}>{open ? 'Tutup sesi' : 'Buka sesi'}</SubmitButton>
            </form>
          </div>
          <p className="text-xs text-muted">Untuk proyektor atau share screen, tayangkan halaman QR (tab baru), bukan halaman ini: daftar soal di bawah memuat kunci jawaban.</p>
        </section>

        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Tile label="Peserta masuk" value={attempts.length} />
            <Tile label="Mengerjakan" value={working} />
            <Tile label="Selesai" value={stats.submittedCount} />
            <Tile label="Rata-rata" value={stats.avgScore ?? '–'} hint={stats.maxScore !== null ? `${stats.minScore}–${stats.maxScore}` : undefined} />
            <Tile label="Pelanggaran" value={stats.totalViolations} tone={stats.totalViolations ? 'text-danger' : ''} />
          </dl>
          <section aria-labelledby="per-soal" className="card flex flex-1 flex-col gap-3.5 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="per-soal" className="display text-[0.95rem]">
                Jawaban benar per soal
              </h2>
              <span className="text-xs text-muted">terendah dulu</span>
            </div>
            {hardest.length ? (
              hardest.map(({ q, i, stat }) => (
                <div key={q.id} className="grid grid-cols-[minmax(0,1fr)_minmax(4rem,10rem)_2.75rem] items-center gap-3.5 text-sm" title={`${stat!.correct} dari ${stat!.answered} peserta menjawab benar`}>
                  <span className="truncate">
                    {i + 1}. {q.text}
                  </span>
                  <span aria-hidden className="h-2 overflow-hidden rounded bg-track">
                    <span
                      className={`block h-full rounded ${stat!.percentage! >= 70 ? 'bg-ok' : stat!.percentage! >= 40 ? 'bg-tier-4' : 'bg-danger'}`}
                      style={{ width: `${stat!.percentage}%` }}
                    />
                  </span>
                  <span className="text-right font-extrabold">{stat!.percentage}%</span>
                </div>
              ))
            ) : (
              <p className="m-auto py-4 text-center text-sm text-muted">Muncul setelah ada peserta yang menjawab.</p>
            )}
          </section>
        </div>
      </div>

      {attempts.length > 0 && (
        <SessionCharts distribution={distribution} totalAttempts={attempts.length} workingCount={working} submittedCount={stats.submittedCount} />
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="display text-lg">Peserta ({attempts.length})</h2>
          <div className="flex flex-wrap gap-2">
            {working > 0 && (
              <form action={forceSubmitAll.bind(null, id)}>
                <SubmitButton
                  confirm={`Paksa kumpulkan ${working} peserta yang masih mengerjakan sekarang? Ujian mereka akan langsung diakhiri.`}
                  className="btn btn-danger text-sm"
                >
                  Paksa kumpul ({working})
                </SubmitButton>
              </form>
            )}
            <a href={`/admin/sessions/${id}/export?format=xlsx`} className="btn btn-secondary text-sm">
              Export Excel
            </a>
            <a href={`/admin/sessions/${id}/export?format=csv`} className="btn btn-secondary text-sm">
              Export CSV
            </a>
            <form action={resetAllAttempts.bind(null, id)}>
              <SubmitButton confirm="Hapus SEMUA peserta beserta jawabannya di sesi ini?" className="btn btn-danger text-sm">
                Reset semua
              </SubmitButton>
            </form>
          </div>
        </div>
        <ParticipantsTable sessionId={id} attempts={attempts} violations={violations} started={started} perQuestion={session.timer_mode === 'per_question'} />
      </section>

      <section className="card space-y-4 p-4 sm:p-6">
        <h2 className="display text-lg">Soal ({questions.length})</h2>
        {locked && <p className="text-sm text-muted">Soal terkunci karena sudah ada peserta atau ujian sudah dimulai. Reset semua peserta untuk mengubah soal.</p>}
        <ol className="space-y-2">
          {questions.map((q, i) => {
            const stat = accuracy.get(q.id)
            return (
              <li key={q.id} className="rounded-xl border border-line p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="whitespace-pre-line font-medium min-w-0 flex-1">
                    {i + 1}. {q.text}
                  </p>
                  {stat && stat.percentage !== null && (
                    <span
                      className={`badge text-xs shrink-0 ${
                        stat.percentage >= 70
                          ? 'bg-ok-soft text-ok'
                          : stat.percentage >= 40
                            ? 'bg-warn-soft text-warn'
                            : 'bg-danger-soft text-danger'
                      }`}
                      title={`${stat.correct} dari ${stat.answered} peserta menjawab benar`}
                    >
                      Akurasi {stat.percentage}% ({stat.correct}/{stat.answered})
                    </span>
                  )}
                </div>
                <ul className="mt-1 space-y-0.5">
                  {q.options.map((option, j) => (
                    <li key={j} className={j === q.answer_index ? 'font-semibold text-ok' : 'text-secondary'}>
                      {q.type === 'mc' && `${String.fromCodePoint(65 + j)}. `}
                      {option}
                      {j === q.answer_index && ' ✓'}
                    </li>
                  ))}
                </ul>
                {!locked && (
                  <div className="mt-2 flex flex-wrap items-start gap-3">
                    <details className="min-w-0 flex-1">
                      <summary className="cursor-pointer text-xs underline">Edit</summary>
                       <div className="mt-2">
                        <QuestionForm action={saveQuestion.bind(null, id, q.id)} question={q} submitLabel="Simpan soal" />
                      </div>
                    </details>
                    <form action={deleteQuestion.bind(null, id, q.id)}>
                      <SubmitButton confirm={`Hapus soal ${i + 1}?`} className="text-xs text-danger underline">
                        Hapus
                      </SubmitButton>
                    </form>
                  </div>
                )}
              </li>
            )
          })}
          {!questions.length && <li className="text-sm text-muted">Belum ada soal. Tambah manual atau upload CSV di bawah.</li>}
        </ol>

        {!locked && (
          <>
            <details open={!questions.length} className="rounded-xl border border-line p-4">
              <summary className="cursor-pointer font-semibold">+ Tambah soal manual</summary>
              <div className="mt-3">
                <QuestionForm action={saveQuestion.bind(null, id, null)} submitLabel="Tambah soal" />
              </div>
            </details>

            <details className="rounded-xl border border-line p-4">
              <summary className="cursor-pointer font-semibold">Upload file soal (Excel / CSV)</summary>
              <div className="mt-3">
                <QuestionUploader action={uploadQuestions.bind(null, id)} questionCount={questions.length} />
              </div>
            </details>
          </>
        )}
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="display mb-4 text-lg">Pengaturan</h2>
        {locked && (
          <p className="-mt-2 mb-4 text-sm text-muted">Mode timer, durasi, dan waktu per soal terkunci karena sudah ada peserta atau ujian sudah dimulai.</p>
        )}
        <SessionForm action={updateSession.bind(null, id)} session={session} submitLabel="Simpan pengaturan" preSessions={preOptions} />
        <form action={deleteSession.bind(null, id)} className="mt-6 border-t border-line pt-4">
          <SubmitButton
            confirm={`Hapus sesi "${session.title}" beserta ${questions.length} soal dan ${attempts.length} peserta? Tidak bisa dibatalkan.`}
            className="btn btn-danger text-sm"
          >
            Hapus sesi
          </SubmitButton>
        </form>
      </section>

    </main>
  )
}

function Tile({ label, value, hint, tone = '' }: Readonly<{ label: string; value: React.ReactNode; hint?: string; tone?: string }>) {
  return (
    <div className="card px-4 py-3.5">
      <dt className="text-[0.8rem] text-muted">{label}</dt>
      <dd className={`display mt-1 text-[1.9rem] ${tone}`}>{value}</dd>
      {hint && <dd className="text-xs text-muted">rentang {hint}</dd>}
    </div>
  )
}
