import Image from 'next/image'

// App name, at the top of every page. Uses /logo.svg. `onBand` when it sits on the red band.
export default function Brand({
  subtitle = 'KSR PMI Unit Universitas Telkom',
  onBand = false,
}: Readonly<{ subtitle?: string | null; onBand?: boolean }>) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex h-10 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-xs">
        <Image src="/logo.svg" alt="Palang Merah Indonesia" width={78} height={36} priority className="h-full w-auto object-contain" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="display text-lg">UjiKSR</p>
        {subtitle && <p className={`text-xs ${onBand ? 'text-on-band/85' : 'text-muted'}`}>{subtitle}</p>}
      </div>
    </div>
  )
}
