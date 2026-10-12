'use client'

import { useState } from 'react'
import SessionForm, { type PreOption } from './session-form'

export default function CreateSessionModal({
  action,
  preSessions = [],
}: {
  action: (formData: FormData) => Promise<void>
  preSessions?: PreOption[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Buat sesi baru
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            className="card relative my-8 w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 sm:p-7 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-line pb-3">
              <h2 id="modal-title" className="display text-xl">
                Buat sesi baru
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-secondary px-2.5 py-1 text-sm leading-none"
                aria-label="Tutup pop-up"
              >
                ✕
              </button>
            </div>
            <SessionForm
              action={action}
              submitLabel="Buat sesi"
              preSessions={preSessions}
            />
          </div>
        </div>
      )}
    </>
  )
}
