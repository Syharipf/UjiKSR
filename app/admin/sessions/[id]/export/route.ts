import Papa from 'papaparse'
import { isAdmin } from '@/lib/admin-auth'
import { finalizeExpired } from '@/lib/attempts'
import { db, must } from '@/lib/db'
import { generateXlsxBuffer, formatDateTime } from '@/lib/excel'
import type { Attempt, Session } from '@/lib/exam'
import type { SurveyAnswerValue, SurveyQuestion } from '@/lib/survey'

const REASON = { manual: 'selesai', timeout: 'waktu habis', violation: 'auto-submit pelanggaran' } as const

export async function GET(_req: Request, ctx: RouteContext<'/admin/sessions/[id]/export'>) {
  if (!(await isAdmin())) return new Response('Unauthorized', { status: 401 })
  const { id } = await ctx.params
  await finalizeExpired(id)
  const session: Pick<Session, 'code' | 'kind' | 'survey_enabled' | 'survey_questions'> = must(
    await db().from('exam_sessions').select('code, kind, survey_enabled, survey_questions').eq('id', id).single(),
  )
  const attempts: Attempt[] = must(await db().from('attempts').select('*').eq('session_id', id).order('name'))

  // Fetch surveys if enabled or present
  let surveysByAttempt = new Map<string, Record<string, string | SurveyAnswerValue>>()
  const surveyQuestions: SurveyQuestion[] = session.survey_questions && Array.isArray(session.survey_questions) ? session.survey_questions : []
  try {
    const svList = (await db().from('participant_surveys').select('attempt_id, answers').eq('session_id', id)).data || []
    surveysByAttempt = new Map(svList.map((s) => [s.attempt_id, (s.answers as Record<string, string | SurveyAnswerValue>) || {}]))
  } catch {}
  const hasSurveys = surveyQuestions.length > 0 || surveysByAttempt.size > 0

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
          ...(hasSurveys
            ? Object.fromEntries(
                surveyQuestions.map((q, i) => {
                  const ans = surveysByAttempt.get(a.id)?.[q.id]
                  let text = ''
                  if (typeof ans === 'object' && ans !== null) {
                    text = ans.value === 'ya' ? `Ya (${ans.detail || '-'})` : ans.value || ''
                  } else if (typeof ans === 'string') {
                    text = ans
                  }
                  return [`survei_${i + 1}_${q.text.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, text]
                }),
              )
            : {}),
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
      ...(hasSurveys
        ? Object.fromEntries(
            surveyQuestions.map((q, i) => {
              const ans = surveysByAttempt.get(a.id)?.[q.id]
              let text = '-'
              if (typeof ans === 'object' && ans !== null) {
                text = ans.value === 'ya' ? `Ya (${ans.detail || '-'})` : ans.value || '-'
              } else if (typeof ans === 'string' && ans) {
                text = ans
              }
              return [`survei_${i + 1}: ${q.text}`, text]
            }),
          )
        : {}),
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
