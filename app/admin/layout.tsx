import Link from 'next/link'
import Brand from '@/app/brand'
import Prinsip from '@/app/prinsip'
import ThemeToggle from '@/app/theme-toggle'

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <>
      <div className="bg-bar text-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" aria-label="Beranda admin" className="min-w-0 [&_.text-muted]:text-white/75">
            <Brand subtitle="Panel panitia KSR PMI Unit Universitas Telkom" />
          </Link>
          <ThemeToggle onBand />
        </div>
        <Prinsip className="gap-1! text-[#c8102e] [&>span]:rounded-none" />
      </div>
      {children}
    </>
  )
}
