import Link from 'next/link'
import { notFound } from 'next/navigation'
import LinkPending from '@/app/link-pending'
import { requireAdmin } from '@/lib/admin-auth'
import { UUID } from '@/lib/attempts'
import { db, must } from '@/lib/db'
import type { Session } from '@/lib/exam'
import type { FeedbackRow } from '@/lib/feedback'
import FeedbackCharts, { type ChartDistribution } from './charts'
import MaterialsSection, { type MaterialGroup } from './materials-section'
import NotesSection, { type NoteItem } from './notes-section'

const formatDec = (val: number) => val.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default async function AdminFeedbackPage(props: PageProps<'/admin/sessions/[id]/feedback'>) {
  await requireAdmin()
  const { id } = await props.params
  if (!UUID.test(id)) notFound()

  const session: Session | null = must(
    await db().from('exam_sessions').select('*').eq('id', id).maybeSingle(),
  )
  if (!session || session.kind !== 'post') notFound()

  // Fetch all attempts count and feedback rows
  const [attemptsRes, feedbackRes] = await Promise.all([
    db().from('attempts').select('id, name, nim, prodi').eq('session_id', id),
    db().from('feedback').select('*, attempts(name, nim, prodi)').eq('session_id', id).order('created_at', { ascending: false }),
  ])

  const attempts = attemptsRes.data || []
  const feedbacks = feedbackRes.data || []

  const totalAttempts = attempts.length
  const totalFeedback = feedbacks.length
  const percentFilled = totalAttempts > 0 ? Math.round((totalFeedback / totalAttempts) * 100) : 0

  // 1. Calculate Averages
  const avgOverall = totalFeedback > 0 ? feedbacks.reduce((acc, f) => acc + f.rating_overall, 0) / totalFeedback : 0
  const avgUnderstanding = totalFeedback > 0 ? feedbacks.reduce((acc, f) => acc + f.rating_understanding, 0) / totalFeedback : 0

  const roomFeedbacks = feedbacks.filter((f) => f.rating_room !== null && f.rating_room !== undefined)
  const avgRoom = roomFeedbacks.length > 0 ? roomFeedbacks.reduce((acc, f) => acc + f.rating_room!, 0) / roomFeedbacks.length : null

  // 2. Material Groups (Answer 01)
  const matMap = new Map<string, { original: string; count: number; participants: { name: string; nim: string }[] }>()
  for (const f of feedbacks) {
    const raw = typeof f.materi === 'string' ? f.materi.trim() : ''
    if (!raw) continue
    const norm = raw.toLowerCase()
    const attempt = f.attempts && typeof f.attempts === 'object' ? f.attempts : null
    const participantName = attempt && typeof (attempt as Record<string, unknown>).name === 'string' ? String((attempt as Record<string, unknown>).name) : 'Peserta'
    const participantNim = attempt && typeof (attempt as Record<string, unknown>).nim === 'string' ? String((attempt as Record<string, unknown>).nim) : '-'

    const entry = matMap.get(norm)
    if (entry) {
      entry.count++
      entry.participants.push({ name: participantName, nim: participantNim })
    } else {
      matMap.set(norm, {
        original: raw,
        count: 1,
        participants: [{ name: participantName, nim: participantNim }],
      })
    }
  }

  const materialGroups: MaterialGroup[] = Array.from(matMap.entries())
    .map(([normalized, item]) => ({
      normalized,
      original: item.original,
      count: item.count,
      participants: item.participants,
    }))
    .sort((a, b) => b.count - a.count)

  // 3. Score Distributions (3 Charts)
  const countDistribution = (getter: (f: FeedbackRow) => number | null | undefined) => {
    const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    for (const f of feedbacks) {
      const v = getter(f as unknown as FeedbackRow)
      if (v && v >= 1 && v <= 5) dist[v] = (dist[v] || 0) + 1
    }
    return dist
  }

  const distOverall = countDistribution((f) => f.rating_overall)
  const distUnderstanding = countDistribution((f) => f.rating_understanding)
  const distRoom = countDistribution((f) => f.rating_room)

  const maxVoteInAnyBar = Math.max(
    1,
    ...Object.values(distOverall),
    ...Object.values(distUnderstanding),
    ...Object.values(distRoom),
  )

  const chartsData: [ChartDistribution, ChartDistribution, ChartDistribution] = [
    {
      title: 'Keseluruhan Pertemuan',
      subtitle: 'Sangat buruk → Sangat baik',
      totalVotes: totalFeedback,
      counts: distOverall,
      maxScale: maxVoteInAnyBar,
    },
    {
      title: 'Pemahaman Materi',
      subtitle: 'Tidak paham → Sangat paham',
      totalVotes: totalFeedback,
      counts: distUnderstanding,
      maxScale: maxVoteInAnyBar,
    },
    {
      title: 'Kondisi Ruangan',
      subtitle: 'Sangat buruk → Sangat baik',
      totalVotes: roomFeedbacks.length,
      counts: distRoom,
      maxScale: maxVoteInAnyBar,
    },
  ]

  // 4. Notes by Category
  const extractNotes = (key: keyof FeedbackRow): NoteItem[] => {
    const list: NoteItem[] = []
    for (const f of feedbacks) {
      const text = f[key]
      if (typeof text === 'string' && text.trim()) {
        const attempt = f.attempts && typeof f.attempts === 'object' ? f.attempts : null
        const name = attempt && typeof (attempt as Record<string, unknown>).name === 'string' ? String((attempt as Record<string, unknown>).name) : 'Peserta'
        const nim = attempt && typeof (attempt as Record<string, unknown>).nim === 'string' ? String((attempt as Record<string, unknown>).nim) : '-'
        list.push({
          id: String(f.id),
          name,
          nim,
          text: text.trim(),
          created_at: String(f.created_at),
        })
      }
    }
    return list
  }

  const notesByTab = {
    speaker: extractNotes('note_speaker'),
    material: extractNotes('note_material'),
    practice: extractNotes('note_practice'),
    room: extractNotes('note_room'),
    next: extractNotes('note_next'),
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 pt-6 pb-14 sm:px-6">
      {/* 1. Header */}
      <div className="space-y-4">
        <Link href={`/admin/sessions/${id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary hover:text-fg">
          &larr; Kembali ke detail sesi
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted font-bold">Rekapitulasi Evaluasi</p>
            <h1 className="display text-3xl font-extrabold text-fg">{session.title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a href={`/admin/sessions/${id}/feedback/export`} className="btn btn-primary text-sm">
              Export feedback (Excel)
            </a>
          </div>
        </div>

        {/* Tab Navigation: [Sesi & peserta] | [Feedback (N)] */}
        <div className="flex border-b border-line text-sm font-semibold">
          <Link
            href={`/admin/sessions/${id}`}
            className="border-b-2 border-transparent px-4 py-2.5 text-secondary hover:text-fg transition-colors"
          >
            Sesi &amp; peserta <LinkPending />
          </Link>
          <div className="border-b-2 border-primary px-4 py-2.5 text-primary flex items-center gap-1.5">
            <span>Feedback</span>
            <span className="badge bg-primary/10 text-primary text-xs px-2 py-0.2 rounded-full">
              {totalFeedback}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Ringkasan 4 Kartu */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4 space-y-1">
          <p className="text-xs font-medium text-muted">Pengisi Feedback</p>
          <p className="display text-2xl sm:text-3xl font-extrabold text-fg">
            {totalFeedback} <span className="text-sm font-normal text-muted">/ {totalAttempts}</span>
          </p>
          <p className="text-xs text-secondary font-medium">{percentFilled}% dari seluruh peserta</p>
        </div>

        <div className="card p-4 space-y-1">
          <p className="text-xs font-medium text-muted">Rata-rata Keseluruhan</p>
          <p className="display text-2xl sm:text-3xl font-extrabold text-fg">
            {totalFeedback > 0 ? formatDec(avgOverall) : '–'} <span className="text-sm font-normal text-muted">/ 5,0</span>
          </p>
          <p className="text-xs text-secondary">Skala 1 (Buruk) – 5 (Baik)</p>
        </div>

        <div className="card p-4 space-y-1">
          <p className="text-xs font-medium text-muted">Rata-rata Pemahaman</p>
          <p className="display text-2xl sm:text-3xl font-extrabold text-fg">
            {totalFeedback > 0 ? formatDec(avgUnderstanding) : '–'} <span className="text-sm font-normal text-muted">/ 5,0</span>
          </p>
          <p className="text-xs text-secondary">Skala 1 (Tidak) – 5 (Paham)</p>
        </div>

        <div className="card p-4 space-y-1">
          <p className="text-xs font-medium text-muted">Rata-rata Ruangan</p>
          <p className="display text-2xl sm:text-3xl font-extrabold text-fg">
            {avgRoom !== null ? formatDec(avgRoom) : '–'} <span className="text-sm font-normal text-muted">/ 5,0</span>
          </p>
          <p className="text-xs text-secondary">{roomFeedbacks.length} peserta menilai ruangan</p>
        </div>
      </section>

      {/* 3. Materi yang ditulis peserta */}
      <MaterialsSection groups={materialGroups} />

      {/* 4. Sebaran Skor (3 Diagram Batang Navy) */}
      <FeedbackCharts charts={chartsData} />

      {/* 5. Kritik dan Saran */}
      <NotesSection notesByTab={notesByTab} />
    </main>
  )
}
