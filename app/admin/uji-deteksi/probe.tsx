'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { enterFullscreen, exitFullscreen } from '@/lib/fullscreen'
import { VIOLATION_LABELS } from '@/lib/violations'
import { useAntiCheat } from '@/app/exam/[id]/use-anti-cheat'

type LogEntry = {
  id: number
  at: string
  hit: boolean
  text: string
}

export default function Probe() {
  const [running, setRunning] = useState(false)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const nextId = useRef(1)

  const push = useCallback((hit: boolean, text: string) => {
    const at = new Date().toLocaleTimeString('id-ID')
    const item: LogEntry = { id: nextId.current++, at, hit, text }
    setEntries((prev) => [item, ...prev].slice(0, 200))
  }, [])

  const onViolation = useCallback(
    (type: string) => {
      push(true, `TERDETEKSI: ${VIOLATION_LABELS[type] ?? type}`)
    },
    [push],
  )

  useAntiCheat(running, onViolation)

  useEffect(() => {
    if (!running) return

    const movedTouchIds = new Set<number>()

    const onTouchStart = (e: TouchEvent) => {
      const clientY = e.changedTouches[0]?.clientY ?? 0
      push(false, `touchstart ×${e.touches.length} y=${Math.round(clientY)}/${window.innerHeight}`)
    }

    const onTouchMove = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const id = e.changedTouches[i].identifier
        if (!movedTouchIds.has(id)) {
          movedTouchIds.add(id)
          const clientY = e.changedTouches[i].clientY
          push(false, `touchmove ×${e.touches.length} y=${Math.round(clientY)}/${window.innerHeight}`)
        }
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        movedTouchIds.delete(e.changedTouches[i].identifier)
      }
      const clientY = e.changedTouches[0]?.clientY ?? 0
      push(false, `touchend ×${e.touches.length} y=${Math.round(clientY)}/${window.innerHeight}`)
    }

    const onTouchCancel = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        movedTouchIds.delete(e.changedTouches[i].identifier)
      }
      const clientY = e.changedTouches[0]?.clientY ?? 0
      push(false, `touchcancel ×${e.touches.length} y=${Math.round(clientY)}/${window.innerHeight}`)
    }

    const onVvResize = () => {
      const vv = window.visualViewport
      if (vv) push(false, `visualViewport resize ${Math.round(vv.width)}×${Math.round(vv.height)}`)
    }

    type RawListener = [EventTarget, string, EventListener, AddEventListenerOptions?]
    const listeners: RawListener[] = [
      [window, 'blur', () => push(false, 'blur')],
      [window, 'focus', () => push(false, 'focus')],
      [window, 'pagehide', () => push(false, 'pagehide')],
      [window, 'pageshow', () => push(false, 'pageshow')],
      [window, 'resize', () => push(false, `resize ${window.innerWidth}×${window.innerHeight}`)],
      [document, 'visibilitychange', () => push(false, `visibility ${document.visibilityState}`)],
      [document, 'freeze', () => push(false, 'freeze')],
      [document, 'resume', () => push(false, 'resume')],
      [document, 'fullscreenchange', () => push(false, `fullscreen ${document.fullscreenElement ? 'on' : 'off'}`)],
      [document, 'touchstart', onTouchStart as EventListener, { passive: true }],
      [document, 'touchmove', onTouchMove as EventListener, { passive: true }],
      [document, 'touchend', onTouchEnd as EventListener, { passive: true }],
      [document, 'touchcancel', onTouchCancel as EventListener, { passive: true }],
      [document, 'pointercancel', () => push(false, 'pointercancel')],
    ]

    listeners.forEach(([target, type, fn, opts]) => target.addEventListener(type, fn, opts))
    window.visualViewport?.addEventListener('resize', onVvResize)

    let lastHasFocus: boolean | null = null
    const focusInterval = setInterval(() => {
      if (typeof document.hasFocus === 'function') {
        const current = document.hasFocus()
        if (current !== lastHasFocus) {
          lastHasFocus = current
          push(false, `hasFocus ${current}`)
        }
      }
    }, 350)

    return () => {
      clearInterval(focusInterval)
      listeners.forEach(([target, type, fn, opts]) => target.removeEventListener(type, fn, opts))
      window.visualViewport?.removeEventListener('resize', onVvResize)
    }
  }, [running, push])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!running ? (
          <button
            type="button"
            onClick={() => {
              enterFullscreen()
              setRunning(true)
            }}
            className="btn btn-primary"
          >
            Mulai uji
          </button>
        ) : (
          <button
            type="button"
            onClick={async () => {
              await exitFullscreen()
              setRunning(false)
            }}
            className="btn btn-secondary"
          >
            Hentikan
          </button>
        )}
        <button type="button" onClick={() => setEntries([])} className="btn btn-secondary">
          Hapus log
        </button>
        <span className="text-xs text-muted">
          Status: {running ? <b className="text-success">Aktif (layar penuh)</b> : 'Mati'} · {entries.length} log
        </span>
      </div>

      <div className="card max-h-[60vh] space-y-1.5 overflow-y-auto p-4 font-mono text-xs sm:p-6">
        {entries.length === 0 ? (
          <p className="text-muted">Belum ada aktivitas. Tekan Mulai uji lalu operasikan HP.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className={entry.hit ? 'font-bold text-danger' : 'text-muted'}>
              <span className="mr-2 opacity-75">{entry.at}</span>
              <span>{entry.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
