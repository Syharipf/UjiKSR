import { handle, readJson } from '@/lib/api'
import { loadCtx, sync } from '@/lib/attempts'
import { db } from '@/lib/db'
import { ExamError } from '@/lib/exam'
import { validateFeedbackPayload, type GoogleSheetsFeedbackPayload } from '@/lib/feedback'
import { sendToGoogleSheets } from '@/lib/google-sheets'

export async function POST(req: Request, ctx: RouteContext<'/api/attempts/[id]/feedback'>) {
  return handle(async () => {
    const now = new Date()
    const { id } = await ctx.params
    const exam = await loadCtx(id)
    await sync(exam, now)

    if (!exam.attempt.submitted_at) {
      throw new ExamError(400, 'Ujian belum selesai dikumpulkan')
    }
    if (exam.session.kind !== 'post') {
      throw new ExamError(400, 'Feedback hanya tersedia untuk sesi post-test')
    }

    const body = await readJson(req)
    const { errors, data } = validateFeedbackPayload(body)
    if (Object.keys(errors).length > 0 || !data) {
      throw new ExamError(400, Object.values(errors)[0] || 'Data feedback tidak valid')
    }

    // Check if feedback for this attempt already exists (unique constraint: 1 feedback per attempt)
    const existing = await db().from('feedback').select('id').eq('attempt_id', exam.attempt.id).maybeSingle()
    if (existing.data) {
      throw new ExamError(409, 'Feedback untuk ujian ini sudah pernah dikirim')
    }

    // Insert into table 'feedback'
    const insertRes = await db().from('feedback').insert({
      attempt_id: exam.attempt.id,
      session_id: exam.session.id,
      materi: data.materi,
      rating_overall: data.rating_overall,
      rating_understanding: data.rating_understanding,
      rating_room: data.rating_room ?? null,
      note_speaker: data.note_speaker ?? null,
      note_material: data.note_material ?? null,
      note_practice: data.note_practice ?? null,
      note_room: data.note_room ?? null,
      note_next: data.note_next ?? null,
    })

    if (insertRes.error) {
      const err = insertRes.error
      if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
        throw new ExamError(409, 'Feedback untuk ujian ini sudah pernah dikirim')
      }
      throw insertRes.error
    }

    // If session has feedback_webhook_url (Google Sheets Web App), inject row into Google Sheet
    if (exam.session.feedback_webhook_url) {
      const sheetsPayload: GoogleSheetsFeedbackPayload = {
        timestamp: now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
        session_title: exam.session.title,
        session_code: exam.session.code,
        name: exam.attempt.name,
        nim: exam.attempt.nim,
        prodi: exam.attempt.prodi,
        score: exam.attempt.score !== null ? exam.attempt.score : 'Belum rilis',
        materi: data.materi,
        rating_overall: data.rating_overall,
        rating_understanding: data.rating_understanding,
        rating_room: data.rating_room ?? '-',
        note_speaker: data.note_speaker ?? '-',
        note_material: data.note_material ?? '-',
        note_practice: data.note_practice ?? '-',
        note_room: data.note_room ?? '-',
        note_next: data.note_next ?? '-',
      }
      await sendToGoogleSheets(exam.session.feedback_webhook_url, sheetsPayload)
    }

    return {
      success: true,
      message: 'Feedback berhasil dikirim',
    }
  })
}
