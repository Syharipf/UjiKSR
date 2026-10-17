'use client'

import { useState } from 'react'
import SubmitButton from '@/app/submit-button'
import { questionImageUrl, type Question } from '@/lib/exam'

const LETTERS = ['A', 'B', 'C', 'D', 'E']
const input = 'field'
// Phone screens are ~400 px wide (×3 density); this keeps photos sharp but small for every participant's download.
const IMAGE_MAX_SIDE = 1200

// Shrink a photo in the browser so the upload fits the server limit and loads fast on participants' phones.
async function shrink(file: File): Promise<File> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  const g = canvas.getContext('2d')!
  g.fillStyle = '#fff' // transparent PNG areas become white, not black
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82))
  return blob ? new File([blob], 'soal.jpg', { type: 'image/jpeg' }) : file
}

// Manual add/edit form. Field names match the CSV columns so the server reuses the CSV validator.
export default function QuestionForm({
  action,
  question,
  submitLabel,
}: Readonly<{
  action: (formData: FormData) => Promise<void>
  question?: Pick<Question, 'id' | 'type' | 'text' | 'options' | 'answer_index' | 'image_rev'>
  submitLabel: string
}>) {
  const [type, setType] = useState(question?.type ?? 'mc')
  const [preview, setPreview] = useState(question ? questionImageUrl(question) : null)
  const [remove, setRemove] = useState(false)
  const mcAnswer = question?.type === 'mc' ? LETTERS[question.answer_index] : 'A'
  const tfAnswer = question?.type === 'tf' && question.answer_index === 1 ? 'S' : 'B'

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget
    const file = el.files?.[0]
    if (!file) return
    const small = await shrink(file).catch(() => file)
    const dt = new DataTransfer()
    dt.items.add(small)
    el.files = dt.files
    setPreview(URL.createObjectURL(small))
    setRemove(false)
  }

  return (
    <form action={action} className="grid gap-3 text-sm">
      <label className="grid gap-1">
        <span>Jenis soal</span>
        <select name="type" value={type} onChange={(e) => setType(e.target.value as 'mc' | 'tf')} className={input}>
          <option value="mc">Pilihan ganda</option>
          <option value="tf">Benar / Salah</option>
        </select>
      </label>
      <label className="grid gap-1">
        <span>Pertanyaan</span>
        <textarea name="question" required rows={3} defaultValue={question?.text} className={input} />
      </label>
      <div className="grid gap-1">
        <label className="grid gap-1">
          <span>Gambar (opsional, JPG/PNG/WebP)</span>
          <input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className={input} />
        </label>
        {preview && !remove && (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: previews and an API route, nothing for next/image to optimize */}
            <img src={preview} alt="Pratinjau gambar soal" className="max-h-40 rounded-lg border border-line" />
            {question?.image_rev && (
              <button type="button" onClick={() => setRemove(true)} className="text-xs text-danger underline">
                Hapus gambar
              </button>
            )}
          </div>
        )}
        {remove && <input type="hidden" name="remove_image" value="1" />}
        {remove && <p className="text-xs text-muted">Gambar akan dihapus saat soal disimpan.</p>}
      </div>
      {type === 'mc' ? (
        <>
          <div className="grid gap-2">
            <p>Opsi jawaban (minimal A dan B, isi berurutan)</p>
            {LETTERS.map((letter, i) => (
              <label key={letter} className="flex items-center gap-2">
                <span className="w-4 font-semibold">{letter}</span>
                <input
                  name={letter.toLowerCase()}
                  required={i < 2}
                  defaultValue={question?.type === 'mc' ? question.options[i] : undefined}
                  className={`min-w-0 flex-1 ${input}`}
                />
              </label>
            ))}
          </div>
          <label className="grid gap-1">
            <span>Jawaban benar</span>
            <select name="answer" defaultValue={mcAnswer} className={input}>
              {LETTERS.map((letter) => (
                <option key={letter}>{letter}</option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <label className="grid gap-1">
          <span>Jawaban benar</span>
          <select name="answer" defaultValue={tfAnswer} className={input}>
            <option value="B">Benar</option>
            <option value="S">Salah</option>
          </select>
        </label>
      )}
      <SubmitButton className="btn btn-primary">{submitLabel}</SubmitButton>
    </form>
  )
}
