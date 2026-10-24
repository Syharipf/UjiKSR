'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type TabKey = 'kontrol' | 'peserta' | 'soal' | 'survei' | 'feedback' | 'pengaturan'

export default function SessionTabs({
  isPost,
  hasSurvey,
  feedbackCount,
  surveyCount,
  participantCount,
  questionCount,
  children,
}: Readonly<{
  isPost: boolean
  hasSurvey?: boolean
  feedbackCount: number
  surveyCount?: number
  participantCount: number
  questionCount: number
  children: {
    kontrol: React.ReactNode
    peserta: React.ReactNode
    soal: React.ReactNode
    survei?: React.ReactNode
    feedback?: React.ReactNode
    pengaturan: React.ReactNode
  }
}>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const rawTab = searchParams.get('tab') as TabKey | null
  const tab: TabKey =
    rawTab === 'peserta' || rawTab === 'soal' || (rawTab === 'survei' && hasSurvey) || (rawTab === 'feedback' && isPost) || rawTab === 'pengaturan'
      ? rawTab
      : 'kontrol'

  const setTab = (nextTab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextTab === 'kontrol') {
      params.delete('tab')
    } else {
      params.set('tab', nextTab)
    }
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'kontrol', label: 'Kontrol' },
    { key: 'peserta', label: 'Peserta', count: participantCount },
    { key: 'soal', label: 'Soal', count: questionCount },
    ...(hasSurvey ? [{ key: 'survei' as TabKey, label: 'Survei', count: surveyCount }] : []),
    ...(isPost ? [{ key: 'feedback' as TabKey, label: 'Feedback', count: feedbackCount }] : []),
    { key: 'pengaturan', label: 'Pengaturan' },
  ]

  return (
    <div className="space-y-6">
      <nav aria-label="Tab navigasi sesi" className="flex overflow-x-auto border-b border-line text-sm font-semibold">
        {tabs.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 whitespace-nowrap transition-colors ${
                active
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-secondary hover:text-fg'
              }`}
            >
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span
                  className={`badge rounded-full px-2 py-0.5 text-xs ${
                    active ? 'bg-primary text-white' : 'bg-subtle text-muted'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div>
        {tab === 'kontrol' && children.kontrol}
        {tab === 'peserta' && children.peserta}
        {tab === 'soal' && children.soal}
        {tab === 'survei' && children.survei}
        {tab === 'feedback' && children.feedback}
        {tab === 'pengaturan' && children.pengaturan}
      </div>
    </div>
  )
}
