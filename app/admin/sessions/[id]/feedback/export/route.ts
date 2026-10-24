import { isAdmin } from '@/lib/admin-auth'
import { db, must } from '@/lib/db'
import { generateXlsxBuffer, formatDateTime } from '@/lib/excel'
import type { Session } from '@/lib/exam'
import type { SurveyAnswerValue, SurveyQuestion } from '@/lib/survey'

export async function GET(_req: Request, ctx: RouteContext<'/admin/sessions/[id]/feedback/export'>) {
  if (!(await isAdmin())) return new Response('Unauthorized', { status: 401 })
  const { id } = await ctx.params

  const session: Pick<Session, 'title' | 'code' | 'kind' | 'survey_enabled' | 'survey_questions'> = must(
    await db().from('exam_sessions').select('title, code, kind, survey_enabled, survey_questions').eq('id', id).single(),
  )
  if (session.kind !== 'post') {
    return new Response('Feedback hanya tersedia untuk sesi post-test', { status: 400 })
  }

  const feedbacks = must(
    await db()
      .from('feedback')
      .select('*, attempts(name, nim, prodi)')
      .eq('session_id', id)
      .order('created_at', { ascending: false }),
  )
  let surveysByAttempt = new Map<string, Record<string, string | SurveyAnswerValue>>()
  const surveyQuestions: SurveyQuestion[] = session.survey_questions && Array.isArray(session.survey_questions) ? session.survey_questions : []
  try {
    const svList = (await db().from('participant_surveys').select('attempt_id, answers').eq('session_id', id)).data || []
    surveysByAttempt = new Map(svList.map((s) => [s.attempt_id, (s.answers as Record<string, string | SurveyAnswerValue>) || {}]))
  } catch {}
  const hasSurveys = surveyQuestions.length > 0 || surveysByAttempt.size > 0

  const rows = feedbacks.map((f: Record<string, unknown>) => {
    const attempt = (f.attempts && typeof f.attempts === 'object' ? f.attempts : {}) as Record<string, unknown>
    const name = typeof attempt.name === 'string' ? attempt.name : '-'
    const nim = typeof attempt.nim === 'string' ? attempt.nim : '-'
    const prodi = typeof attempt.prodi === 'string' ? attempt.prodi : '-'

    return {
      nama: name,
      nim,
      prodi,
      waktu_kirim: formatDateTime(String(f.created_at)),
      ...(hasSurveys
        ? Object.fromEntries(
            surveyQuestions.map((q, i) => {
              const attemptId = String(f.attempt_id || '')
              const ans = surveysByAttempt.get(attemptId)?.[q.id]
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
      materi_01: String(f.materi || '-'),
      penilaian_keseluruhan_02: Number(f.rating_overall) || 0,
      pemahaman_materi_03: Number(f.rating_understanding) || 0,
      penilaian_ruangan_04: f.rating_room ? Number(f.rating_room) : '-',
      saran_pemateri_05: String(f.note_speaker || '-'),
      kritik_materi_06: String(f.note_material || '-'),
      kejelasan_praktik_07: String(f.note_practice || '-'),
      saran_ruangan_08: String(f.note_room || '-'),
      saran_pertemuan_berikutnya_09: String(f.note_next || '-'),
    }
  })

  const buf = generateXlsxBuffer('Feedback Peserta', rows)
  return new Response(buf as BodyInit, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="feedback-${session.code}.xlsx"`,
    },
  })
}
