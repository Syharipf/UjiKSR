// One-shot CSS confetti burst (styles in globals.css). Positions come from the index, not
// Math.random, so renders stay pure. Hidden when the device asks for reduced motion.
const COLORS = ['#c8102e', '#13294b', '#f3b14e', '#8fb2ff', '#ff7d8a']

export default function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {Array.from({ length: 40 }, (_, i) => (
        <span
          key={i}
          className="confetti"
          style={
            {
              left: `${(i * 37) % 100}%`,
              background: COLORS[i % COLORS.length],
              animationDelay: `${(i % 10) * 0.12}s`,
              animationDuration: `${2.4 + (i % 4) * 0.4}s`,
              '--drift': `${((i * 53) % 120) - 60}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
