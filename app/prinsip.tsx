// Seven segments, one for each Fundamental Principle of the Red Cross and Red Crescent Movement:
// Kemanusiaan, Kesamaan, Kenetralan, Kemandirian, Kesukarelaan, Kesatuan, Kesemestaan.
// Takes its colour from `currentColor` (styles: .prinsip in globals.css).
export const PRINSIP = ['Kemanusiaan', 'Kesamaan', 'Kenetralan', 'Kemandirian', 'Kesukarelaan', 'Kesatuan', 'Kesemestaan']

export default function Prinsip({ className = '' }: Readonly<{ className?: string }>) {
  return (
    <div aria-hidden className={`prinsip ${className}`}>
      {PRINSIP.map((p) => (
        <span key={p} />
      ))}
    </div>
  )
}
