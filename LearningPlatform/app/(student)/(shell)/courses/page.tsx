import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  buildCoursesCatalogWhere,
  CATALOG_LEVEL_OPTIONS,
  CATALOG_SORT_LABELS,
  COURSES_CATALOG_PAGE_SIZE,
  parseCatalogSearchParams,
  serializeCatalogQuery,
} from '@/lib/courses-catalog'
import { CourseCatalogCard } from '@/components/courses/course-catalog-card'
import { studentGlassCard, studentGlassFooterNavButton } from '@/lib/student-glass-styles'
import { cn } from '@/lib/utils'
import { auth } from '@/auth'
import { courseVisibleToGroup, getUserGroupId } from '@/lib/course-visibility'
import { isStaffRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CoursesPage({ searchParams }: PageProps) {
  const raw = await searchParams
  const filters = parseCatalogSearchParams(raw)
  const payload = await getPayload({ config })
  const session = await auth()
  const isAdmin = isStaffRole(session?.user?.role)
  const userGroupId = isAdmin ? null : await getUserGroupId(session?.user?.id)

  const [{ docs: subjectDocs }, coursesResult] = await Promise.all([
    payload.find({
      collection: 'subjects',
      sort: 'name',
      limit: 500,
      depth: 0,
    }),
    // Fetch all published courses matching the filters, then apply group-based
    // visibility and pagination in JS (group membership lives in Prisma, so it
    // cannot be expressed in a single Payload `where`).
    payload.find({
      collection: 'courses',
      where: buildCoursesCatalogWhere(filters),
      sort: filters.sort,
      limit: 1000,
      depth: 1,
    }),
  ])

  const visibleCourses = isAdmin
    ? coursesResult.docs
    : coursesResult.docs.filter((course) =>
        courseVisibleToGroup((course as { publishGroupIds?: unknown }).publishGroupIds, userGroupId),
      )

  const totalDocs = visibleCourses.length
  const courses = visibleCourses.slice(
    (filters.page - 1) * COURSES_CATALOG_PAGE_SIZE,
    filters.page * COURSES_CATALOG_PAGE_SIZE,
  )

  const lastPage = Math.max(1, Math.ceil(totalDocs / COURSES_CATALOG_PAGE_SIZE))
  if (filters.page > lastPage && totalDocs > 0) {
    const qs = serializeCatalogQuery({ ...filters, page: lastPage }, lastPage)
    redirect(qs ? `/courses?${qs}` : '/courses')
  }

  const currentPage = Math.min(filters.page, lastPage)
  const prevQs = currentPage > 1 ? serializeCatalogQuery(filters, currentPage - 1) : ''
  const nextQs = currentPage < lastPage ? serializeCatalogQuery(filters, currentPage + 1) : ''

  return (
    <div className="container mx-auto px-6 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="flex w-full flex-col gap-0">
          <div className="flex w-full justify-start">
            <Button
              variant="outline"
              size="sm"
              asChild
              className={cn('min-w-[10rem] shrink-0', studentGlassFooterNavButton)}
            >
              <Link href="/dashboard" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to dashboard
              </Link>
            </Button>
          </div>
          <div className="mx-auto w-full max-w-3xl p-0 text-center">
            <h1 className="mb-3 mt-0 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-4xl">
              Discover courses
            </h1>
            <p className="text-lg leading-relaxed text-gray-600 dark:text-gray-400 md:text-xl">
              Browse our catalog of published courses. Your progress is saved so you can pick up where you left off
              whenever you are ready.
            </p>
          </div>
        </div>

        <form
          action="/courses"
          method="get"
          className={cn('grid gap-4 p-4 shadow-none md:grid-cols-2 md:p-6 lg:grid-cols-12 lg:items-end', studentGlassCard)}
        >
        <div className="flex flex-col gap-1.5 lg:col-span-3">
          <label htmlFor="catalog-q" className="text-sm font-medium text-foreground">
            Search by title
          </label>
          <Input
            id="catalog-q"
            name="q"
            type="search"
            placeholder="Type a course name…"
            defaultValue={filters.q}
            autoComplete="off"
            className={cn(
              // Match native selects: Input component still adds dark:bg-input/30 unless overridden here.
              'h-10 w-full border border-input bg-background text-sm text-foreground shadow-xs dark:bg-background',
              'placeholder:text-muted-foreground',
              'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <label htmlFor="catalog-level" className="text-sm font-medium text-foreground">
            Level
          </label>
          <select
            id="catalog-level"
            name="level"
            defaultValue={filters.level}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {CATALOG_LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 lg:col-span-3">
          <label htmlFor="catalog-subject" className="text-sm font-medium text-foreground">
            Subject
          </label>
          <select
            id="catalog-subject"
            name="subject"
            defaultValue={filters.subject}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">All subjects</option>
            {subjectDocs.map((s) => (
              <option key={String(s.id)} value={String(s.id)}>
                {String(s.name ?? '')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 lg:col-span-3">
          <label htmlFor="catalog-sort" className="text-sm font-medium text-foreground">
            Sort by
          </label>
          <select
            id="catalog-sort"
            name="sort"
            defaultValue={filters.sort}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {CATALOG_SORT_LABELS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 lg:col-span-1">
          <span className="invisible select-none text-sm font-medium text-foreground" aria-hidden>
            Apply
          </span>
          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="auth-hero-cta h-10 w-full shrink-0 px-4 lg:w-auto"
          >
            Apply
          </Button>
        </div>
        </form>

        {courses.length === 0 ? (
          <Card className={cn('border-0 shadow-none', studentGlassCard)}>
            <CardContent className="space-y-3 pt-8 pb-8">
              <p className="text-center text-gray-600 dark:text-gray-400">
                {filters.q || filters.level || filters.subject
                  ? 'No courses match your filters. Try adjusting search, level, or subject.'
                  : 'No courses available yet. Check back soon.'}
              </p>
              {(filters.q || filters.level || filters.subject) && (
                <p className="text-center">
                  <Link
                    href="/courses"
                    className="text-sm font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                  >
                    Clear all filters
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {courses.map((course) => (
                <CourseCatalogCard key={String(course.id)} course={course} />
              ))}
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200/60 bg-white/40 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between md:px-6 md:py-4">
              <p className="text-center text-sm text-muted-foreground md:text-left">
                Showing{' '}
                <span className="font-medium tabular-nums text-foreground">
                  {(currentPage - 1) * COURSES_CATALOG_PAGE_SIZE + 1}
                </span>
                {'–'}
                <span className="font-medium tabular-nums text-foreground">
                  {Math.min(currentPage * COURSES_CATALOG_PAGE_SIZE, totalDocs)}
                </span>{' '}
                of <span className="font-medium tabular-nums text-foreground">{totalDocs}</span> course
                {totalDocs === 1 ? '' : 's'}
              </p>
              <div className="flex items-center justify-center gap-2 sm:justify-end">
                {currentPage > 1 ? (
                  <Button variant="outline" size="sm" className="h-8 px-2" asChild>
                    <Link href={prevQs ? `/courses?${prevQs}` : '/courses'}>
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Previous page</span>
                    </Link>
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="h-8 px-2" disabled>
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Previous page</span>
                  </Button>
                )}
                <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-muted-foreground">
                  {currentPage} / {lastPage}
                </span>
                {currentPage < lastPage ? (
                  <Button variant="outline" size="sm" className="h-8 px-2" asChild>
                    <Link href={nextQs ? `/courses?${nextQs}` : '/courses'}>
                      <ChevronRight className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Next page</span>
                    </Link>
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="h-8 px-2" disabled>
                    <ChevronRight className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Next page</span>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
