'use client'

import { useRef, useState } from 'react'
import SubmitButton from '@/app/submit-button'

function UploadIcon({ size = 32, className = '' }: Readonly<{ size?: number; className?: string }>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 16.5v2.25A2.25 2.25 0 0 0 6.25 21h11.5A2.25 2.25 0 0 0 20 18.75V16.5" />
      <path d="m7.5 10 4.5-4.5 4.5 4.5" />
      <path d="M12 5.5v11" />
    </svg>
  )
}

function FileIcon({ size = 20, className = '' }: Readonly<{ size?: number; className?: string }>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function QuestionUploader({
  action,
  questionCount,
  disabled = false,
}: Readonly<{
  action: (formData: FormData) => Promise<void>
  questionCount: number
  disabled?: boolean
}>) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (disabled) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      setSelectedFile(file)
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(file)
        fileInputRef.current.files = dataTransfer.files
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  const clearFile = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <form action={action}>
        <label
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
            disabled
              ? 'cursor-not-allowed opacity-50 border-line bg-surface/30'
              : isDragOver
                ? 'cursor-pointer border-primary bg-primary/5 shadow-inner'
                : 'cursor-pointer border-line hover:border-primary/70 hover:bg-surface/50'
          }`}
        >
          {/* Native file input fully interactive across the whole label container */}
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            disabled={disabled}
            onChange={handleFileChange}
            className="absolute inset-0 z-0 h-full w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />

          {selectedFile ? (
            <div className="relative z-10 flex flex-col items-center gap-2 pointer-events-none">
              <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 border border-line text-sm pointer-events-auto">
                <FileIcon className="text-primary shrink-0" />
                <span className="font-medium text-fg max-w-[260px] sm:max-w-md truncate" title={selectedFile.name}>
                  {selectedFile.name}
                </span>
                <span className="text-xs text-muted">({formatBytes(selectedFile.size)})</span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="ml-2 text-xs font-semibold text-danger hover:underline cursor-pointer"
                  title="Hapus pilihan"
                >
                  Batal
                </button>
              </div>
              <p className="text-xs text-muted">Klik atau drop file lain jika ingin mengganti.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <UploadIcon />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-fg">
                  Tarik &amp; lepas file Excel (.xlsx) atau CSV di sini
                </p>
                <p className="text-xs text-muted">atau klik untuk menelusuri file dari perangkat</p>
              </div>
            </div>
          )}
        </label>

        {/* Action area: upload text button */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            {selectedFile ? (
              <SubmitButton
                confirm={
                  questionCount > 0
                    ? `Upload akan MENGGANTI ${questionCount} soal yang ada. Lanjutkan?`
                    : undefined
                }
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline cursor-pointer"
              >
                Upload &amp; ganti semua soal
              </SubmitButton>
            ) : (
              <span className="text-xs text-muted italic">Pilih atau letakkan file di atas untuk memulai upload</span>
            )}
          </div>
        </div>
      </form>

      <p className="text-sm text-muted">
        Format: <code>type,question,a,b,c,d,e,answer</code>. Mendukung file Excel (.xlsx) dan CSV (.csv). Unduh template:{' '}
        <a href="/contoh-soal.xlsx" download className="font-semibold underline">
          Excel (.xlsx)
        </a>{' '}
        ·{' '}
        <a href="/contoh-soal.csv" download className="underline">
          CSV (.csv)
        </a>
      </p>
    </div>
  )
}
