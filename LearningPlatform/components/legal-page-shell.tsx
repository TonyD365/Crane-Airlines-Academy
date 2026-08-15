import Link from 'next/link'

/**
 * Simple, theme-aware shell for standalone legal pages (Privacy, Terms).
 * Kept self-contained so the pages render without the student/admin shells.
 */
export function LegalPageShell({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <header className="bg-[#2b295c] text-white dark:bg-[#1e1c40]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            Crane Airlines Academy
          </Link>
          <Link href="/login" className="text-sm font-medium text-white/80 hover:text-white">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Last updated: {lastUpdated}</p>
        <div className="legal-body mt-8 space-y-6 text-[0.95rem] leading-relaxed">{children}</div>

        <div className="mt-12 border-t border-slate-200 pt-6 text-sm dark:border-slate-800">
          <Link href="/login" className="font-medium text-[#2b295c] hover:underline dark:text-indigo-300">
            ← Back to sign in
          </Link>
        </div>
      </main>
    </div>
  )
}

/** Shared section heading for legal pages. */
export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{heading}</h2>
      <div className="space-y-2 text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  )
}
