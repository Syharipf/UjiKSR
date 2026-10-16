// Plays a soft audio chime when the exam finishes.
// Uses Web Audio API oscillator so it requires no external assets and works offline.
export function playFinishSound() {
  try {
    const Ctx = window.AudioContext || ('webkitAudioContext' in window ? (window as unknown as Record<string, typeof AudioContext>)['webkitAudioContext'] : undefined)
    if (!Ctx) return
    const ctx = new Ctx()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const now = ctx.currentTime
    // Chime notes: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz)
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.12)

      gain.gain.setValueAtTime(0, now + idx * 0.12)
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.12 + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + idx * 0.12)
      osc.stop(now + idx * 0.12 + 0.65)
    })
  } catch {
    // AudioContext blocked or unsupported, silently ignore
  }
}

// Triggers haptic feedback on mobile devices for violations
export function triggerViolationVibration() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      // Distinct double buzz: 200ms buzz, 100ms pause, 300ms buzz
      navigator.vibrate([200, 100, 300])
    }
  } catch {
    // Vibrate unsupported, silently ignore
  }
}
