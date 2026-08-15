'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  Brain,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  SquareStack,
  Zap,
} from 'lucide-react'
import { ArchiveCourseButton, UnarchiveCourseButton } from '@/components/profile/archive-actions'

export type MoodleLesson = {
  id: string
  title: string
  order: number
  href: string
  done: boolean
}

export type MoodleFlashcards = {
  name: string | null
  total: number
  newCards: number
  due: number
  srsHref: string
  freeHref: string
}

export type MoodleSection = {
  id: string
  title: string
  lessons: MoodleLesson[]
  flashcards: MoodleFlashcards | null
}

export type MoodleCourseMeta = {
  title: string
  bannerUrl: string | null
  level: string
  subjectLabel: string
}

export type MoodleMainDeck = {
  courseTitle: string
  name: string | null
  due: number
  newCards: number
  total: number
  srsHref: string
  freeHref: string
  browseHref: string
}

function StatPill({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex min-w-[4.25rem] flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
      <span className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{count}</span>
      <span className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
    </div>
  )
}

const flashPill =
  'inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#2b295c] hover:text-[#2b295c] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-300'

function FlashcardBox({ fc }: { fc: MoodleFlashcards }) {
  return (
    <div className="mt-3 rounded-lg border border-dashed border-[#2b295c]/30 bg-[#2b295c]/[0.04] p-4 dark:border-indigo-400/30 dark:bg-indigo-400/[0.06]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2b295c]/10 text-[#2b295c] dark:bg-indigo-400/20 dark:text-indigo-300">
            <SquareStack className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Flashcards</p>
            {fc.name ? <p className="truncate text-xs text-slate-500 dark:text-slate-400">{fc.name}</p> : null}
            <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {fc.total} cards · {fc.newCards} new · {fc.due} due
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <Link href={fc.srsHref} className={flashPill}>
            <Brain className="h-3.5 w-3.5" /> SRS study
          </Link>
          <Link href={fc.freeHref} className={flashPill}>
            <Zap className="h-3.5 w-3.5" /> Free study
          </Link>
        </div>
      </div>
    </div>
  )
}

export function MoodleCourseView({
  slug,
  meta,
  sections,
  mainDeck,
  courseArchived,
  courseId,
}: {
  slug: string
  meta: MoodleCourseMeta
  sections: MoodleSection[]
  mainDeck: MoodleMainDeck | null
  courseArchived: boolean
  courseId: string
}) {
  const [indexOpen, setIndexOpen] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const allCollapsed = useMemo(
    () => sections.length > 0 && sections.every((s) => collapsed.has(s.id)),
    [sections, collapsed],
  )

  const toggleSection = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () =>
    setCollapsed(allCollapsed ? new Set() : new Set(sections.map((s) => s.id)))

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#2b295c] hover:underline dark:text-indigo-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {/* Banner */}
        {meta.bannerUrl ? (
          <div className="relative h-40 w-full sm:h-52 md:h-60">
            <Image src={meta.bannerUrl} alt={meta.title} fill unoptimized className="object-cover" />
          </div>
        ) : (
          <div className="h-24 w-full bg-gradient-to-r from-[#2b295c] to-[#4b478f]" />
        )}

        <div className="p-4 sm:p-6">
          {/* Title + meta */}
          <div className="mb-4 border-l-4 border-[#2b295c] pl-3 dark:border-indigo-400">
            <h1 className="text-2xl font-bold uppercase tracking-tight text-[#2b295c] dark:text-indigo-200 md:text-3xl">
              {meta.title}
            </h1>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
              {meta.subjectLabel ? <span className="uppercase tracking-wide">{meta.subjectLabel}</span> : null}
              {meta.level ? <span className="uppercase tracking-wide">· {meta.level}</span> : null}
            </div>
          </div>

          {/* Toolbar */}
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIndexOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {indexOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              {indexOpen ? 'Hide' : 'Course index'}
            </button>
            <button
              type="button"
              onClick={toggleAll}
              className="text-sm font-medium text-[#2b295c] hover:underline dark:text-indigo-300"
            >
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
          </div>

          <div className="lg:flex lg:gap-6">
            {/* Course index */}
            {indexOpen ? (
              <aside className="mb-6 w-full shrink-0 lg:mb-0 lg:w-72">
                <nav className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                  {sections.map((section) => (
                    <div key={section.id} className="mb-2 last:mb-0">
                      <a
                        href={`#section-${section.id}`}
                        className="block rounded-md px-2 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                      >
                        {section.title}
                      </a>
                      <ul className="mt-0.5 space-y-0.5">
                        {section.lessons.map((lesson) => (
                          <li key={lesson.id}>
                            <Link
                              href={lesson.href}
                              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              {lesson.done ? (
                                <span
                                  aria-label="Completed"
                                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                                >
                                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                                </span>
                              ) : (
                                <span
                                  aria-hidden
                                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-400 dark:border-slate-500"
                                />
                              )}
                              <span className="min-w-0 truncate">{lesson.title}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </nav>
              </aside>
            ) : null}

            {/* Main content */}
            <div className="min-w-0 flex-1 space-y-4">
              {sections.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  Course content is being prepared. Check back soon!
                </p>
              ) : (
                sections.map((section) => {
                  const isCollapsed = collapsed.has(section.id)
                  const doneCount = section.lessons.filter((l) => l.done).length
                  return (
                    <section
                      key={section.id}
                      id={`section-${section.id}`}
                      className="scroll-mt-24 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSection(section.id)}
                        className="flex w-full items-center gap-3 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
                        )}
                        <span className="flex-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {section.title}
                        </span>
                        {section.lessons.length > 0 ? (
                          <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                            {doneCount}/{section.lessons.length} done
                          </span>
                        ) : null}
                      </button>

                      {!isCollapsed ? (
                        <div className="space-y-2 px-4 py-4">
                          {section.lessons.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">No lessons available</p>
                          ) : (
                            section.lessons.map((lesson) => (
                              <Link
                                key={lesson.id}
                                href={lesson.href}
                                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:border-[#2b295c]/40 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-indigo-400/40 dark:hover:bg-slate-800"
                              >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#2b295c]/10 text-[#2b295c] dark:bg-indigo-400/20 dark:text-indigo-300">
                                  <BookOpen className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1 font-medium text-slate-800 dark:text-slate-100">
                                  {lesson.title}
                                </span>
                                {lesson.done ? (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                    <Check className="h-3.5 w-3.5" strokeWidth={2.75} /> Done
                                  </span>
                                ) : null}
                              </Link>
                            ))
                          )}

                          {section.flashcards ? <FlashcardBox fc={section.flashcards} /> : null}
                        </div>
                      ) : null}
                    </section>
                  )
                })
              )}

              {/* Course-wide flashcards */}
              {mainDeck ? (
                <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700 sm:p-6">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Flashcards for this course
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Study the full course deck, or use the module boxes above to focus one section at a time.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <StatPill label="due" count={mainDeck.due} />
                    <StatPill label="new" count={mainDeck.newCards} />
                    <StatPill label="total" count={mainDeck.total} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={mainDeck.srsHref} className={flashPill}>
                      <Brain className="h-3.5 w-3.5" /> SRS study
                    </Link>
                    <Link href={mainDeck.freeHref} className={flashPill}>
                      <Zap className="h-3.5 w-3.5" /> Free study
                    </Link>
                    <Link href={mainDeck.browseHref} className={flashPill}>
                      <Layers className="h-3.5 w-3.5" /> Browse in dashboard
                    </Link>
                  </div>
                </section>
              ) : null}

              <div className="flex justify-center pt-2">
                {courseArchived ? (
                  <UnarchiveCourseButton courseId={courseId} />
                ) : (
                  <ArchiveCourseButton courseSlug={slug} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
