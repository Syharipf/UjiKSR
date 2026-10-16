import Papa from 'papaparse'
import { isAdmin } from '@/lib/admin-auth'
import { finalizeExpired } from '@/lib/attempts'
import { db, must } from '@/lib/db'
import { generateXlsxBuffer, formatDateTime } from '@/lib/excel'
import type { Attempt } from '@/lib/exam'

const REASON = { manual: 'selesai', timeout: 'waktu habis', violation: 'auto-submit pelanggaran' } as const

export async function GET(_req: Request, ctx: RouteContext<'/admin/sessions/[id]/export'>) {
  if (!(await isAdmin())) return new Response('Unauthorized', { status: 401 })
  const { id } = await ctx.params
  await finalizeExpired(id)
  const session: { code: string; kind: string } = must(await db().from('exam_sessions').select('code, kind').eq('id', id).single())
  const attempts: Attempt[] = must(await db().from('attempts').select('*').eq('session_id', id).order('name'))

  // Fetch feedbacks for post-test sessions (tolerant if table doesn't exist yet)
  let feedbacksByAttempt = new Map<string, { rating: number; clarity: number | null; difficulty: string | null; comment: string | null }>()
  if (session.kind === 'post') {
    try {
      const fbList = (await db().from('feedback').select('attempt_id, rating, clarity, difficulty, comment').eq('session_id', id)).data || []
      feedbacksByAttempt = new Map(fbList.map((f) => [f.attempt_id, f]))
    } catch {}
  }
  const format = new URL(_req.url).searchParams.get('format')?.toLowerCase()
  if (format === 'csv') {
    const csv = Papa.unparse(
      attempts.map((a) => {
        const fb = feedbacksByAttempt.get(a.id)
        return {
          nama: a.name,
          nim: a.nim,
          prodi: a.prodi,
          nilai: a.score ?? '',
          pelanggaran: a.violation_count,
          status: a.submit_reason ? REASON[a.submit_reason] : 'belum selesai',
          ...(session.kind === 'post'
            ? {
                rating_feedback: fb ? fb.rating : '',
                kesulitan_materi: fb ? (fb.difficulty ?? '') : '',
                kritik_saran: fb ? (fb.comment ?? '') : '',
              }
            : {}),
          mulai: a.started_at,
          selesai: a.submitted_at ?? '',
        }
      }),
      { escapeFormulae: true }, // names are participant input; stop =cmd() tricks in Excel
    )
    return new Response('﻿' + csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="hasil-${session.code}.csv"`,
      },
    })
  }

  const rows = attempts.map((a) => {
    const fb = feedbacksByAttempt.get(a.id)
    return {
      nama: a.name,
      nim: a.nim,
      prodi: a.prodi,
      nilai: a.score ?? '',
      pelanggaran: a.violation_count,
      status: a.submit_reason ? REASON[a.submit_reason] : 'belum selesai',
      ...(session.kind === 'post'
        ? {
            rating_feedback: fb ? `${fb.rating}/5` : '-',
            kesulitan: fb ? (fb.difficulty === 'easy' ? 'Mudah' : fb.difficulty === 'medium' ? 'Sedang' : fb.difficulty === 'hard' ? 'Sulit' : '-') : '-',
            kritik_saran: fb?.comment || '-',
          }
        : {}),
      mulai: formatDateTime(a.started_at),
      selesai: formatDateTime(a.submitted_at),
    }
  })
  const buf = generateXlsxBuffer('Hasil Ujian', rows)
  return new Response(buf as BodyInit, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="hasil-${session.code}.xlsx"`,
    },
  })
}
