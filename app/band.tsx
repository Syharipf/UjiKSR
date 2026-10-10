import Prinsip from './prinsip'

// The red band that heads participant pages, closed by the seven-segment principles rule.
export default function Band({ children, className = '' }: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <header className={`bg-band text-on-band ${className}`}>
      <div className="mx-auto flex max-w-md flex-col gap-6 px-5 pt-5 pb-5">
        {children}
        <Prinsip />
      </div>
    </header>
  )
}
