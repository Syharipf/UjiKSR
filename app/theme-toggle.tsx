'use client'

import { useSyncExternalStore } from 'react'
import { THEME_KEY } from '@/lib/theme'

type Theme = 'light' | 'dark'

const LABEL: Record<Theme, string> = { light: 'Terang', dark: 'Gelap' }

const listeners = new Set<() => void>()
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const read = (): Theme => {
  if (typeof document === 'undefined') return 'light'
  const t = document.documentElement.dataset.theme
  if (t === 'light' || t === 'dark') return t
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

function apply(theme: Theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {}
  listeners.forEach((l) => l())
}

// `onBand` when it sits on the red mitela band.
// 2-way toggle: Terang ↔ Gelap with instant 1-click visual feedback. `compact` shows only the icon.
export default function ThemeToggle({ compact = false, onBand = false }: Readonly<{ compact?: boolean; onBand?: boolean }>) {
  const theme = useSyncExternalStore(subscribe, read, () => 'light' as Theme)
  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={() => apply(nextTheme)}
      aria-label={`Tema: ${LABEL[theme]}. Ketuk untuk ganti ke mode ${LABEL[nextTheme].toLowerCase()}.`}
      title={`Tema: ${LABEL[theme]} (ketuk untuk mode ${LABEL[nextTheme].toLowerCase()})`}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        onBand ? 'border-on-band/40 hover:bg-on-band/10' : 'border-line-strong hover:bg-subtle'
      }`}
    >
      <Icon theme={theme} />
      {!compact && LABEL[theme]}
    </button>
  )
}

function Icon({ theme }: Readonly<{ theme: Theme }>) {
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true }
  if (theme === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}
