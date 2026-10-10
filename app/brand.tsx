// App name, at the top of every page. No logo yet. `onBand` when it sits on the red band.
export default function Brand({
  subtitle = 'KSR PMI Unit Universitas Telkom',
  onBand = false,
}: Readonly<{ subtitle?: string | null; onBand?: boolean }>) {
  return (
    <div className="min-w-0 leading-tight">
      <p className="display text-lg">UjiKSR</p>
      {subtitle && <p className={`text-xs ${onBand ? 'text-on-band/85' : 'text-muted'}`}>{subtitle}</p>}
    </div>
  )
}
