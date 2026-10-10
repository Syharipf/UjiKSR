import Link from 'next/link'
import { redirect } from 'next/navigation'
import Band from './band'
import Brand from './brand'
import SubmitButton from './submit-button'
import ThemeToggle from './theme-toggle'

async function open(formData: FormData) {
  'use server'
  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  if (code) redirect(`/s/${encodeURIComponent(code)}`)
}

const STEPS = ['Scan QR atau masukkan kode dari panitia', 'Isi nama lengkap, NIM, dan prodi', 'Kerjakan dalam layar penuh sampai selesai']

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Band>
        <div className="flex items-center justify-between gap-3">
          <Brand onBand />
          <ThemeToggle compact onBand />
        </div>
        <div className="space-y-3 pt-4">
          <h1 className="display text-[clamp(1.25rem,6.4vw,2.1rem)] text-balance">
            Siap uji pengetahuan <span className="whitespace-nowrap">kepalangmerahanmu?</span>
          </h1>
          <p className="text-on-band/90">Masukkan kode sesi dari panitia untuk mulai.</p>
        </div>
      </Band>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-5 pt-7 pb-6">
        <form action={open} className="flex flex-col gap-2.5">
          <label htmlFor="code" className="text-sm font-bold">
            Kode sesi
          </label>
          <input
            id="code"
            name="code"
            required
            maxLength={10}
            placeholder="AB12CD"
            autoCapitalize="characters"
            autoComplete="off"
            className="field h-15 text-2xl font-extrabold tracking-[0.22em] uppercase [font-stretch:125%] placeholder:font-semibold placeholder:text-line-strong"
          />
          <SubmitButton className="btn btn-primary h-13 w-full text-base">Masuk</SubmitButton>
        </form>

        <ol className="space-y-3.5 text-secondary">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-baseline gap-3.5">
              <span className="display w-3.5 shrink-0 text-primary">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <p className="mt-auto text-xs text-muted">
          Panitia?{' '}
          <Link href="/admin" className="font-bold text-fg underline-offset-2 hover:underline">
            Masuk panel panitia
          </Link>
        </p>
      </main>
    </div>
  )
}
