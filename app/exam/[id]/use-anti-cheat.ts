'use client'

import { useEffect } from 'react'
import { isFullscreen } from '@/lib/fullscreen'

// One slip (switching apps) fires blur + visibilitychange + fullscreenchange together; count it once.
const DEBOUNCE_MS = 2000
// Split screen roughly halves the viewport; rotating the phone keeps the area about the same.
const MIN_AREA_RATIO = 0.6
const BLOCKED = ['contextmenu', 'copy', 'cut', 'selectstart', 'dragstart'] as const

// `awake`: hold the screen on (also while waiting in the lobby, so the phone is unlocked when the questions appear).
export function useAntiCheat(active: boolean, onViolation: (type: string) => void, awake = active) {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault()
    BLOCKED.forEach((t) => document.addEventListener(t, block))
    return () => BLOCKED.forEach((t) => document.removeEventListener(t, block))
  }, [])

  // Keep the screen on: a phone that auto-locks while someone reads a question would count as leaving.
  // The lock is dropped whenever the page is hidden, so take it again on return.
  useEffect(() => {
    if (!awake || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | undefined
    let done = false
    const acquire = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then(
        (l) => {
          if (done) l.release().catch(() => {})
          else lock = l
        },
        () => {},
      )
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      done = true
      document.removeEventListener('visibilitychange', acquire)
      lock?.release().catch(() => {})
    }
  }, [awake])

  useEffect(() => {
    if (!active) return
    let last = 0
    let maxArea = window.innerWidth * window.innerHeight

    const report = (type: string) => {
      const now = Date.now()
      if (now - last < DEBOUNCE_MS) return
      last = now
      onViolation(type)
    }

    // Android notification panel / Google Assistant / Circle to Search overlay:
    // When the top status bar / notification shade is pulled down or an assistant overlay appears,
    // Android pauses input focus from the web view.
    // 1. document.hasFocus() immediately returns false even before any blur event is dispatched.
    // 2. window.blur & window.focusout fire when focus transitions.
    // 3. fullscreenchange fires if pulling down the notification shade cancels immersion.
    const checkFocus = () => {
      if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
        report('blur')
      }
    }

    const listeners: [EventTarget, string, EventListener][] = [
      [document, 'visibilitychange', (() => document.visibilityState === 'hidden' && report('hidden')) as EventListener],
      [window, 'blur', (() => report('blur')) as EventListener],
      [window, 'focusout', (() => checkFocus()) as EventListener],
      [document, 'fullscreenchange', (() => !isFullscreen() && report('fullscreen_exit')) as EventListener],
      [
        window,
        'resize',
        (() => {
          const area = window.innerWidth * window.innerHeight
          if (isFullscreen()) maxArea = Math.max(maxArea, area)
          if (area < maxArea * MIN_AREA_RATIO) report('resize')
        }) as EventListener,
      ],
    ]
    listeners.forEach(([target, type, fn]) => target.addEventListener(type, fn))

    // Active polling for document.hasFocus() to catch notification shade dragging & floating overlays
    const focusInterval = setInterval(checkFocus, 350)

    return () => {
      clearInterval(focusInterval)
      listeners.forEach(([target, type, fn]) => target.removeEventListener(type, fn))
    }
  }, [active, onViolation])
}
