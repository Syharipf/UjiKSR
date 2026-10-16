import { isAdmin } from '@/lib/admin-auth'
import { db, must } from '@/lib/db'
import { generateXlsxBuffer, formatDateTime } from '@/lib/excel'

export async function GET(_req: Request, ctx: RouteContext<'/admin/sessions/[id]/feedback/export'>) {
  if (!(await isAdmin())) return new Response('Unauthorized', { status: 401 })
  const { id } = await ctx.params

  const session: { title: string; code: string; kind: string } = must(
    await db().from('exam_sessions').select('title, code, kind').eq('id', id).single(),
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
