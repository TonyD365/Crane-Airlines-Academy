'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

export type OverviewCourse = {
  id: string
  title: string
  slug: string
  category: string
  imageFilename: string | null
}

export type OverviewProgress = {
  progressPercentage: number
  hasStarted: boolean
}

type Filter = 'all' | 'inprogress' | 'completed' | 'notstarted'
type SortKey = 'name' | 'lastAccessed'
type View = 'card' | 'list'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'inprogress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'notstarted', label: 'Not started' },
]

const controlClass =
  'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-[#2b295c] focus:outline-none focus:ring-2 focus:ring-[#2b295c]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'

function CourseCard({
  course,
  progress,
}: {
  course: OverviewCourse
  progress?: OverviewProgress
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress?.progressPercentage ?? 0)))
  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <Link href={`/courses/${course.slug}`} className="relative block h-36 w-full overflow-hidden bg-slate-100 dark:bg-slate-700">
        {course.imageFilename ? (
          <Image
            src={`/api/media/serve/${encodeURIComponent(course.imageFilename)}`}
            alt={course.title}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2b295c] to-[#4b478f] text-white/80">
            <span className="text-sm font-medium">{course.category || 'Course'}</span>
          </div>
        )}
      </Link>

      {progress?.hasStarted ? (
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700">
          <div className="h-full bg-[#2b295c] dark:bg-indigo-400" style={{ width: `${pct}%` }} />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-4">
        <Link
          href={`/courses/${course.slug}`}
          className="text-base font-semibold text-[#2b295c] hover:underline dark:text-indigo-300"
        >
          {course.title}
        </Link>
        {course.category ? (
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {course.category}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-xs text-slate-400">
            {progress?.hasStarted ? `${pct}% complete` : 'Not started'}
          </span>
          <Link
            href={`/courses/${course.slug}`}
            aria-label={`Open ${course.title}`}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          >
            <MoreVertical className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function CourseListRow({
  course,
  progress,
}: {
  course: OverviewCourse
  progress?: OverviewProgress
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress?.progressPercentage ?? 0)))
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded bg-slate-100 dark:bg-slate-700">
        {course.imageFilename ? (
          <Image
            src={`/api/media/serve/${encodeURIComponent(course.imageFilename)}`}
            alt={course.title}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#2b295c] to-[#4b478f]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-[#2b295c] dark:text-indigo-300">{course.title}</p>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {course.category}
        </p>
      </div>
      <span className="shrink-0 text-sm text-slate-400">
        {progress?.hasStarted ? `${pct}%` : '—'}
      </span>
    </Link>
  )
}

export function MoodleCourseOverview({
  userName,
  courses,
  progressByCourseId,
}: {
  userName: string
  courses: OverviewCourse[]
  progressByCourseId: Record<string, OverviewProgress>
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [view, setView] = useState<View>('card')

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = courses.filter((c) => {
      const p = progressByCourseId[c.id]
      const pct = p?.progressPercentage ?? 0
      if (filter === 'inprogress' && !(p?.hasStarted && pct < 100)) return false
      if (filter === 'completed' && pct < 100) return false
      if (filter === 'notstarted' && p?.hasStarted) return false
      if (q && !c.title.toLowerCase().includes(q)) return false
      return true
    })
    // 'name' → alphabetical; 'lastAccessed' → keep the server's recent-activity order.
    if (sort === 'name') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title))
    }
    return list
  }, [courses, progressByCourseId, filter, search, sort])

  return (
    <section>
      {/* Section label */}
      <div className="mb-4 flex items-center gap-3">
        <span className="h-6 w-1 rounded-full bg-[#2b295c] dark:bg-indigo-400" aria-hidden />
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#2b295c] dark:text-indigo-300">
          My courses
        </h2>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
        Hi, {userName}! <span aria-hidden>👋</span>
      </h1>

      <h3 className="mt-6 text-xl font-semibold text-slate-800 dark:text-slate-100">Course overview</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Filter and search across the courses you are enrolled in.
      </p>
      <hr className="mt-3 border-slate-200 dark:border-slate-700" />

      {/* Controls */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className={controlClass}
          aria-label="Filter courses"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          className={cn(controlClass, 'min-w-[12rem] flex-1 md:flex-none')}
          aria-label="Search courses"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className={controlClass}
          aria-label="Sort courses"
        >
          <option value="name">Sort by course name</option>
          <option value="lastAccessed">Sort by last accessed</option>
        </select>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as View)}
          className={controlClass}
          aria-label="View mode"
        >
          <option value="card">Card</option>
          <option value="list">List</option>
        </select>
      </div>

      {/* Courses */}
      <div className="mt-6">
        {visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
            No courses to show. Try adjusting the filter or search.
          </p>
        ) : view === 'card' ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((c) => (
              <CourseCard key={c.id} course={c} progress={progressByCourseId[c.id]} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((c) => (
              <CourseListRow key={c.id} course={c} progress={progressByCourseId[c.id]} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
