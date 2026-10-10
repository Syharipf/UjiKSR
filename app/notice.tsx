import Band from './band'
import Brand from './brand'
import ThemeToggle from './theme-toggle'

// Full-page message for participants (session not found, closed, loading, …).
export default function Notice({ title, body, children }: Readonly<{ title: string; body?: string; children?: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Band>
        <div className="flex items-center justify-between gap-3">
          <Brand onBand />
          <ThemeToggle compact onBand />
        </div>
      </Band>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pt-6 pb-16">
        <div className="card flex flex-col gap-2 p-6 text-center">
          <h1 className="display text-2xl text-balance">{title}</h1>
          {body && <p className="text-secondary text-pretty">{body}</p>}
          {children}
        </div>
      </main>
    </div>
  )
}
