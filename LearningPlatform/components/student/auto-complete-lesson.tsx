'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { markLessonComplete } from '@/app/actions/lesson-progress'

/**
 * For lessons with no practice tasks: automatically mark the lesson complete
 * once the student has viewed it (scrolled to the end — which is immediate for
 * short lessons that fit on screen). Runs only on a real client view, so a
 * Next.js link prefetch does not mark lessons complete.
 */
export function AutoCompleteLesson({
  lessonId,
  courseSlug,
  initialCompleted,
}: {
  lessonId: string
  courseSlug: string
  initialCompleted: boolean
}) {
  const [completed, setCompleted] = useState(initialCompleted)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const firedRef = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (completed || firedRef.current) return
    const el = sentinelRef.current
    if (!el) return

    const markDone = () => {
      if (firedRef.current) return
      firedRef.current = true
      void (async () => {
        try {
          await markLessonComplete(lessonId, courseSlug)
          setCompleted(true)
          router.refresh()
        } catch {
          // Allow a later retry if marking failed.
          firedRef.current = false
        }
      })()
    }

    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: no observer support — mark after a short dwell.
      const t = window.setTimeout(markDone, 4000)
      return () => window.clearTimeout(t)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) markDone()
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [completed, lessonId, courseSlug, router])

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      {completed ? (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <Check className="h-4 w-4" strokeWidth={2.75} /> Lesson completed
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">
          This lesson is marked complete once you&rsquo;ve read through it.
        </span>
      )}
    </div>
  )
}
