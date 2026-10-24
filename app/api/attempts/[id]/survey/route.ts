import { handle, readJson } from '@/lib/api'
import { loadCtx, sync } from '@/lib/attempts'
import { db } from '@/lib/db'
import { ExamError } from '@/lib/exam'
import { validateSurveyAnswers } from '@/lib/survey'

export async function POST(req: Request, ctx: RouteContext<'/api/attempts/[id]/survey'>) {
  return handle(async () => {
    const now = new Date()
    const { id } = await ctx.params
    const exam = await loadCtx(id)
    await sync(exam, now)

    if (!exam.attempt.submitted_at) {
      throw new ExamError(400, 'Ujian belum selesai dikumpulkan')
    }

    if (!exam.session.survey_enabled || !exam.session.survey_questions || exam.session.survey_questions.length === 0) {
      throw new ExamError(400, 'Survei tidak aktif untuk sesi ini')
    }

    const body = await readJson(req)
    const validation = validateSurveyAnswers(exam.session.survey_questions, body)
    if (!validation.valid) {
      throw new ExamError(400, validation.error)
    }

    // Check duplicate
    const existing = await db().from('participant_surveys').select('id').eq('attempt_id', exam.attempt.id).maybeSingle()
    if (existing.data) {
      throw new ExamError(409, 'Survei untuk ujian ini sudah pernah dikirim')
    }

    const insertRes = await db().from('participant_surveys').insert({
      attempt_id: exam.attempt.id,
      session_id: exam.session.id,
      answers: validation.data,
    })

    if (insertRes.error) {
      const err = insertRes.error
      if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
        throw new ExamError(409, 'Survei untuk ujian ini sudah pernah dikirim')
      }
      throw insertRes.error
    }

    return {
      success: true,
      message: 'Survei berhasil dikirim',
    }
  })
}
