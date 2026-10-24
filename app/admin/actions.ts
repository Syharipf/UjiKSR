'use server'

import { randomInt } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { COOKIE, makeToken, passwordMatches, TTL_MS } from '@/lib/admin-token'
import { parseQuestionsCsv, toQuestion } from '@/lib/csv'
import { parseQuestionsXlsx } from '@/lib/excel'
import { finishRound, forceSubmitAll as attemptsForceSubmitAll, invalidateResultsStatus, UUID } from '@/lib/attempts'
import { db, must } from '@/lib/db'
import { cleanTopic, isOpen, START_DELAY_MS, timing, type Question, type Session } from '@/lib/exam'

const back = (id: string, msg: string, tab?: string) =>
  redirect(`/admin/sessions/${id}?msg=${encodeURIComponent(msg)}${tab ? `&tab=${tab}` : ''}`)

export async function login(formData: FormData) {
  if (!process.env.ADMIN_PASSWORD) {
    redirect('/admin/login?error=env')
  }
  if (!passwordMatches(String(formData.get('password') ?? ''))) {
    await new Promise((r) => setTimeout(r, 1000)) // slow down guessing
    redirect('/admin/login?error=1')
  }
  ;(await cookies()).set(COOKIE, makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_MS / 1000,
  })
  redirect('/admin')
}

export async function logout() {
  ;(await cookies()).delete(COOKIE)
  redirect('/admin/login')
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O, 1/I
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('')

function sessionFields(f: FormData) {
  const int = (key: string, min: number, max: number) => {
    const n = Number(f.get(key))
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${key} harus ${min}-${max}`)
    return n
  }
  const title = String(f.get('title') ?? '').trim()
  const kind = String(f.get('kind'))
  const timer_mode = String(f.get('timer_mode'))
  const held_on = String(f.get('held_on') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(held_on) || Number.isNaN(Date.parse(held_on))) throw new Error('Tanggal sesi tidak valid')
  if (!title || title.length > 120 || !['pre', 'post'].includes(kind) || !['total', 'per_question'].includes(timer_mode)) {
    throw new Error('Data sesi tidak valid')
  }
  // Only the chosen mode's time: the form disables (so doesn't send) the other, which keeps its stored value.
  const time: Partial<Pick<Session, 'duration_sec' | 'per_question_sec'>> =
    timer_mode === 'total' ? { duration_sec: int('duration_min', 1, 600) * 60 } : { per_question_sec: int('per_question_sec', 5, 600) }
  // Post-test only: the pre-test its participants' scores are compared with (by NIM). Checked in pairWith.
  const pre = kind === 'post' ? String(f.get('pre_session_id') ?? '') : ''
  if (pre && !UUID.test(pre)) throw new Error('Pasangan pre-test tidak valid')
  // Sent only for post-tests (a pre-test's stale pair is cleared).
  const postFields: { pre_session_id?: string | null; feedback_url?: string | null; feedback_webhook_url?: string | null } =
    kind === 'post'
      ? { pre_session_id: pre || null, feedback_url: null, feedback_webhook_url: null }
      : { pre_session_id: null, feedback_url: null, feedback_webhook_url: null }
  const survey_enabled = f.get('survey_enabled') === 'on'
  let survey_questions = null
  if (survey_enabled) {
    const rawQuestions = f.get('survey_questions')
    if (typeof rawQuestions === 'string' && rawQuestions.trim()) {
      try {
        const parsed = JSON.parse(rawQuestions)
        if (Array.isArray(parsed) && parsed.length > 0) {
          survey_questions = parsed
        }
      } catch {}
    }
  }
  return {
    title,
    held_on,
    kind,
    timer_mode,
    ...time,
    max_violations: int('max_violations', 1, 999),
    camera_check: f.get('camera_check') === 'on',
    survey_enabled,
    survey_questions,
    ...postFields,
  }
}

// The chosen pair must be an existing pre-test (and not the session itself).
async function checkPair(preId: string | null, selfId?: string) {
  if (!preId) return
  const pre: Pick<Session, 'id' | 'kind'> | null = must(await db().from('exam_sessions').select('id, kind').eq('id', preId).maybeSingle())
  if (!pre || pre.kind !== 'pre' || pre.id === selfId) throw new Error('Pasangan pre-test tidak valid')
}

export async function createSession(formData: FormData) {
  await requireAdmin()
  const fields = sessionFields(formData)

  // If post-test has no explicit pre_session_id chosen, try to auto-pair with pre-test having matching title
  if (fields.kind === 'post' && !fields.pre_session_id) {
    const topic = cleanTopic(fields.title).toLowerCase()
    if (topic) {
      const candidates: Pick<Session, 'id' | 'title' | 'held_on'>[] = must(
        await db().from('exam_sessions').select('id, title, held_on').eq('kind', 'pre').order('created_at', { ascending: false }),
      )
      const matched = candidates.find((c) => cleanTopic(c.title).toLowerCase() === topic)
      if (matched) {
        fields.pre_session_id = matched.id
      }
    }
  }

  await checkPair(fields.pre_session_id ?? null)
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db().from('exam_sessions').insert({ ...fields, code: newCode() }).select('id').single()
    if (error?.code === '23505') continue // code collision, try another
    if (error?.code === 'PGRST204') {
      const stripped: Record<string, unknown> = { ...fields }
      delete stripped.feedback_webhook_url
      delete stripped.feedback_url
      delete stripped.survey_enabled
      delete stripped.survey_questions
      const fallback = await db().from('exam_sessions').insert({ ...stripped, code: newCode() }).select('id').single()
      if (fallback.data) redirect(`/admin/sessions/${fallback.data.id}`)
      if (fallback.error?.code === '23505') continue
      if (fallback.error) throw fallback.error
    }
    if (error) throw error
    redirect(`/admin/sessions/${data.id}`)
  }
  throw new Error('Gagal membuat kode sesi unik')
}

export async function updateSession(id: string, formData: FormData) {
  await requireAdmin()
  const fields = sessionFields(formData)

  // If post-test has no explicit pre_session_id chosen, try to auto-pair with pre-test having matching title
  if (fields.kind === 'post' && !fields.pre_session_id) {
    const topic = cleanTopic(fields.title).toLowerCase()
    if (topic) {
      const candidates: Pick<Session, 'id' | 'title' | 'held_on'>[] = must(
        await db().from('exam_sessions').select('id, title, held_on').eq('kind', 'pre').neq('id', id).order('created_at', { ascending: false }),
      )
      const matched = candidates.find((c) => cleanTopic(c.title).toLowerCase() === topic)
      if (matched) {
        fields.pre_session_id = matched.id
      }
    }
  }

  await checkPair(fields.pre_session_id ?? null, id)
  // The shared clock and attempts use the current settings (deadlines, per-question order);
  // changing them underneath would move deadlines or let per-question takers go back.
  if (await isLocked(id)) {
    const current: Pick<Session, TimerField> = must(await db().from('exam_sessions').select(TIMER_FIELDS.join(',')).eq('id', id).single())
    if (TIMER_FIELDS.some((key) => key in fields && fields[key] !== current[key])) return back(id, TIMER_LOCKED)
  }
  const { error } = await db().from('exam_sessions').update(fields).eq('id', id)
  if (error) {
    // If the database has not yet been upgraded with feedback_webhook_url or feedback_url, retry progressively
    if ((error as { code?: string }).code === 'PGRST204') {
      const withoutCols: Record<string, unknown> = { ...fields }
      delete withoutCols.survey_enabled
      delete withoutCols.survey_questions
      delete withoutCols.feedback_webhook_url
      delete withoutCols.feedback_url
      const retry1 = await db().from('exam_sessions').update(withoutCols).eq('id', id)
      if (retry1.error) throw retry1.error
    } else {
      throw error
    }
  }
  back(id, 'Pengaturan tersimpan', 'pengaturan')
}

type TimerRow = Pick<Session, TimerField | 'is_open' | 'closes_at' | 'started_at'> & { questions: { count: number }[] }
const timerRow = async (id: string): Promise<TimerRow> =>
  must(await db().from('exam_sessions').select('is_open, closes_at, started_at, timer_mode, duration_sec, per_question_sec, questions(count)').eq('id', id).single())

// Opening a session opens the lobby: participants join and wait for "Mulai ujian".
export async function setOpen(id: string, open: boolean) {
  await requireAdmin()
  if (open) {
    const s = await timerRow(id)
    if (s.started_at) {
      await finishRound(id)
    }
    const fields: Partial<Session> = { is_open: true, started_at: null, closes_at: null }
    const update = db().from('exam_sessions').update(fields).eq('id', id)
    const opened = must(await (s.started_at === null ? update.is('started_at', null) : update.eq('started_at', s.started_at)).select('id'))
    if (!opened.length) return back(id, 'Status sesi berubah — muat ulang halaman lalu coba lagi')
  } else {
    const s = await timerRow(id)
    if (s.started_at) {
      await attemptsForceSubmitAll(id)
    } else {
      must(await db().from('exam_sessions').update({ is_open: false, closes_at: null }).eq('id', id))
    }
  }
  back(id, open ? 'Sesi dibuka' : 'Sesi ditutup')
}

// Starts every participant's clock at the same moment, START_DELAY_MS from now (see lib/exam.ts).
export async function startExam(id: string) {
  await requireAdmin()
  const s = await timerRow(id)
  const count = s.questions[0]?.count ?? 0
  if (!isOpen(s) || s.started_at) return back(id, 'Ujian hanya bisa dimulai saat sesi dibuka dan belum dimulai')
  if (!count) return back(id, 'Belum ada soal')
  const clock = timing(s, count, new Date(Date.now() + START_DELAY_MS))
  const started = must(
    await db().from('exam_sessions').update({ started_at: clock.started_at, closes_at: clock.deadline_at }).eq('id', id).is('started_at', null).select('id'),
  )
  if (!started.length) return back(id, 'Ujian sudah dimulai')
  // Lobby attempts carry placeholder clocks from their join; a join landing after this is re-timed by sync().
  must(await db().from('attempts').update(clock).eq('session_id', id).is('submitted_at', null).lt('started_at', clock.started_at))
  back(id, 'Ujian dimulai')
}

// Adds extra time to a running session, extending closes_at and all active attempts' deadlines.
export async function extendSession(id: string, formData: FormData) {
  await requireAdmin()
  const raw = formData.get('minutes')
  const minutes = Math.round(Number(raw))
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 180) {
    return back(id, 'Waktu tambahan tidak valid (1–180 menit)')
  }
  const s = await timerRow(id)
  if (!s.started_at) return back(id, 'Waktu hanya bisa ditambah saat ujian sudah dimulai')
  if (!s.is_open) return back(id, 'Sesi sudah ditutup')

  const addedSec = minutes * 60
  const now = Date.now()
  const currentClosesAt = s.closes_at ? Date.parse(s.closes_at) : now
  const baseTime = Math.max(now, currentClosesAt)
  const newClosesAt = new Date(baseTime + addedSec * 1000)

  const sessionUpdate: { closes_at: string; duration_sec?: number } = {
    closes_at: newClosesAt.toISOString(),
  }
  if (s.timer_mode === 'total') {
    const startedAtMs = Date.parse(s.started_at)
    sessionUpdate.duration_sec = Math.max(s.duration_sec + addedSec, Math.round((newClosesAt.getTime() - startedAtMs) / 1000))
  }
  must(await db().from('exam_sessions').update(sessionUpdate).eq('id', id))

  // Update deadline_at for all participants who are currently still working
  must(
    await db()
      .from('attempts')
      .update({ deadline_at: newClosesAt.toISOString() })
      .eq('session_id', id)
      .is('submitted_at', null),
  )

  invalidateResultsStatus(id)
  back(id, `Waktu ujian berhasil ditambah ${minutes} menit`)
}

// Questions, attempts and violations go with it (on delete cascade).
export async function deleteSession(id: string) {
  await requireAdmin()
  must(await db().from('exam_sessions').delete().eq('id', id))
  redirect('/admin')
}

// Attempts reference question ids and option counts; a started exam's clock also depends on the settings.
async function isLocked(sessionId: string) {
  const { count, error } = await db().from('attempts').select('id', { count: 'exact', head: true }).eq('session_id', sessionId)
  if (error) throw error
  if (count) return true
  const session: Pick<Session, 'started_at'> = must(await db().from('exam_sessions').select('started_at').eq('id', sessionId).single())
  return session.started_at !== null
}
const LOCKED = 'Sudah ada peserta atau ujian sudah dimulai. Reset semua peserta dulu sebelum mengubah soal.'
const TIMER_FIELDS = ['timer_mode', 'duration_sec', 'per_question_sec'] as const
type TimerField = (typeof TIMER_FIELDS)[number]
const TIMER_LOCKED = 'Pengaturan belum tersimpan — timer terkunci karena sudah ada peserta atau ujian sudah dimulai. Reset semua peserta dulu untuk mengubah timer.'

export async function uploadQuestions(id: string, formData: FormData) {
  await requireAdmin()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return back(id, 'Pilih file soal dulu')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) {
    return back(id, 'Format .xls lama tidak didukung. Simpan sebagai .xlsx atau .csv terlebih dahulu.')
  }
  const isXlsx = bytes[0] === 0x50 && bytes[1] === 0x4b
  const { questions, errors } = isXlsx
    ? parseQuestionsXlsx(bytes)
    : parseQuestionsCsv(new TextDecoder().decode(bytes))
  if (errors.length) return back(id, `Upload gagal — ${errors.slice(0, 5).join(' · ')}`)
  if (!questions.length) return back(id, 'File tidak berisi soal')
  if (await isLocked(id)) return back(id, LOCKED)

  must(await db().from('questions').delete().eq('session_id', id))
  must(await db().from('questions').insert(questions.map((q) => ({ ...q, session_id: id }))))
  back(id, `${questions.length} soal tersimpan`, 'soal')
}

// Add (questionId null) or edit one question from the manual form.
export async function saveQuestion(sessionId: string, questionId: string | null, formData: FormData) {
  await requireAdmin()
  const field = (key: string) => {
    const value = formData.get(key)
    return typeof value === 'string' ? value : ''
  }
  const q = toQuestion({ type: field('type'), text: field('question'), options: ['a', 'b', 'c', 'd', 'e'].map(field), answer: field('answer') })
  if (typeof q === 'string') return back(sessionId, `Soal belum tersimpan — ${q}`, 'soal')
  const file = formData.get('image')
  const image = file instanceof File && file.size > 0 ? await readImage(file) : null
  if (typeof image === 'string') return back(sessionId, `Soal belum tersimpan — ${image}`, 'soal')
  if (await isLocked(sessionId)) return back(sessionId, LOCKED, 'soal')

  let id = questionId
  if (id) {
    must(await db().from('questions').update(q).eq('id', id).eq('session_id', sessionId))
  } else {
    const last: { position: number } | null = must(
      await db().from('questions').select('position').eq('session_id', sessionId).order('position', { ascending: false }).limit(1).maybeSingle(),
    )
    const row: { id: string } = must(await db().from('questions').insert({ ...q, session_id: sessionId, position: (last?.position ?? -1) + 1 }).select('id').single())
    id = row.id
  }
  if (image) {
    must(await db().from('question_images').upsert({ question_id: id, ...image }))
    must(await db().from('questions').update({ image_rev: Date.now().toString(36) }).eq('id', id))
  } else if (formData.get('remove_image')) {
    must(await db().from('question_images').delete().eq('question_id', id))
    must(await db().from('questions').update({ image_rev: null }).eq('id', id))
  }
  back(sessionId, questionId ? 'Soal diperbarui' : 'Soal ditambahkan', 'soal')
}

// The browser shrinks pictures before upload (question-form.tsx); this is the server's own check.
const IMAGE_MAX_BYTES = 700_000
async function readImage(file: File): Promise<{ mime: string; data: string } | string> {
  if (file.size > IMAGE_MAX_BYTES) return 'gambar terlalu besar (maks. 700 KB)'
  const bytes = Buffer.from(await file.arrayBuffer())
  // Trust the bytes, not the browser's content type.
  const mime =
    bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg'
    : bytes.subarray(0, 4).toString('hex') === '89504e47' ? 'image/png'
    : bytes.subarray(8, 12).toString('latin1') === 'WEBP' ? 'image/webp'
    : null
  if (!mime) return 'gambar harus JPG, PNG, atau WebP'
  return { mime, data: bytes.toString('base64') }
}

export async function deleteQuestion(sessionId: string, questionId: string) {
  await requireAdmin()
  if (await isLocked(sessionId)) return back(sessionId, LOCKED, 'soal')
  must(await db().from('questions').delete().eq('id', questionId).eq('session_id', sessionId))
  back(sessionId, 'Soal dihapus', 'soal')
}

export async function resetAttempt(sessionId: string, attemptId: string) {
  await requireAdmin()
  must(await db().from('attempts').delete().eq('id', attemptId).eq('session_id', sessionId))
  back(sessionId, 'Peserta direset dan bisa mulai ulang', 'peserta')
}

export async function resetAllAttempts(sessionId: string) {
  await requireAdmin()
  must(await db().from('exam_sessions').update({ started_at: null, closes_at: null }).eq('id', sessionId)) // a fresh lobby
  must(await db().from('attempts').delete().eq('session_id', sessionId))
  back(sessionId, 'Semua peserta direset')
}

export async function forceSubmitAll(sessionId: string) {
  await requireAdmin()
  await attemptsForceSubmitAll(sessionId)
  back(sessionId, 'Semua peserta yang masih aktif berhasil dikumpulkan')
}

export async function duplicateSession(sessionId: string) {
  await requireAdmin()
  const source: Session = must(await db().from('exam_sessions').select('*').eq('id', sessionId).single())
  const questions: Pick<Question, 'id' | 'type' | 'text' | 'options' | 'answer_index' | 'position' | 'image_rev'>[] = must(
    await db().from('questions').select('id, type, text, options, answer_index, position, image_rev').eq('session_id', sessionId).order('position'),
  )

  const newKind = source.kind === 'pre' ? 'post' : 'pre'
  const newTitle =
    source.kind === 'pre'
      ? source.title.replace(/pre[- ]?test/i, 'Post-test').replace(/pre/i, 'Post')
      : `${source.title} (Salinan)`

  let newSessionId = ''
  for (let i = 0; i < 5; i++) {
    const { data, error } = await db()
      .from('exam_sessions')
      .insert({
        title: newTitle,
        held_on: source.held_on,
        kind: newKind,
        timer_mode: source.timer_mode,
        duration_sec: source.duration_sec,
        per_question_sec: source.per_question_sec,
        max_violations: source.max_violations,
        camera_check: source.camera_check ?? false,
        survey_enabled: source.survey_enabled ?? false,
        survey_questions: source.survey_questions ?? null,
        // A post-test made from a pre-test is paired with it, so scores can be compared.
        ...(newKind === 'post' ? { pre_session_id: source.id } : {}),
        is_open: false,
        code: newCode(),
      })
      .select('id')
      .single()
    if (error?.code === '23505') continue
    if (error) throw error
    newSessionId = data.id
    break
  }
  if (!newSessionId) throw new Error('Gagal membuat kode sesi unik')

  if (questions.length) {
    const copies: { id: string; position: number }[] = must(
      await db()
        .from('questions')
        .insert(questions.map((q) => ({ type: q.type, text: q.text, options: q.options, answer_index: q.answer_index, position: q.position, image_rev: q.image_rev, session_id: newSessionId })))
        .select('id, position'),
    )
    const withImage = questions.filter((q) => q.image_rev)
    if (withImage.length) {
      const images: { question_id: string; mime: string; data: string }[] = must(
        await db().from('question_images').select('question_id, mime, data').in('question_id', withImage.map((q) => q.id)),
      )
      const newId = new Map(copies.map((c) => [c.position, c.id]))
      const oldPos = new Map(questions.map((q) => [q.id, q.position]))
      must(await db().from('question_images').insert(images.map((img) => ({ ...img, question_id: newId.get(oldPos.get(img.question_id)!)! }))))
    }
  }
  redirect(`/admin/sessions/${newSessionId}?msg=${encodeURIComponent(`Sesi berhasil diduplikasi (${questions.length} soal disalin)`)}`)
}
