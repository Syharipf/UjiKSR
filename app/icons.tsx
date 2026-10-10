// Small stroke icons shared across pages. Decorative: the text next to them carries the meaning.
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

export function Megaphone({ size = 16, className = '' }: Readonly<{ size?: number; className?: string }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M3 11l15-6v14L3 13z" />
      <path d="M18 9a3 3 0 0 1 0 6" />
      <path d="M7 13.5l1.5 5.5h3L10 14.6" />
    </svg>
  )
}

export function Lock({ size = 14, className = '' }: Readonly<{ size?: number; className?: string }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export function Chevron({ dir, size = 16, className = '' }: Readonly<{ dir: 'left' | 'right' | 'down'; size?: number; className?: string }>) {
  const d = dir === 'left' ? 'M15 18l-6-6 6-6' : dir === 'right' ? 'M9 18l6-6-6-6' : 'M6 9l6 6 6-6'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base} strokeWidth={2.4}>
      <path d={d} />
    </svg>
  )
}
