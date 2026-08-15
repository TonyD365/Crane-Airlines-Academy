'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { markLessonComplete } from '@/app/actions/lesson-progress'

/**
 * For lessons with no practice tasks: automatically mark the lesson complete
 * when the student opens (views) it. Runs only on a real client mount, so a
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
  const firedRef = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (initialCompleted || firedRef.current) return
    firedRef.current = true
    void (async () => {
      try {
        await markLessonComplete(lessonId, courseSlug)
        setCompleted(true)
        router.refresh()
      } catch {
        // Allow a retry on the next view if marking failed.
        firedRef.current = false
      }
    })()
  }, [initialCompleted, lessonId, courseSlug, router])

  return (
    <div className="mt-6 flex justify-center">
      {completed ? (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <Check className="h-4 w-4" strokeWidth={2.75} /> Lesson completed
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">Marking this lesson as complete…</span>
      )}
    </div>
  )
}
