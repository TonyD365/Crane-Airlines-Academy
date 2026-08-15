'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Image as ImageIcon, Plus, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import {
  updateCourse,
  createCourse,
  createModule,
  toggleCoursePublish,
  publishCourseTree,
  deleteCourse,
} from '@/app/(admin)/admin/actions'
import { useRouter } from 'next/navigation'
import { ModulesList } from './modules-list'
import { MediaPicker } from './media-picker'
import { FormError, FieldError } from '@/components/ui/form-error'
import { ZodError } from 'zod'
import { cn } from '@/lib/utils'
import { adminGlassCard, adminGlassOutlineButton } from '@/lib/student-glass-styles'

interface Course {
  id: string
  title: string
  slug: string
  description?: string
  subject: string | { id?: string | number; name?: string }
  level: string
  isPublished: boolean
  topics?: string[]
  publishGroupIds?: string[]
  coverImage?: { id: string | number; filename: string; alt?: string | null } | string | number | null
}

function coverIdFromCourse(c: Course): string {
  const ci = c.coverImage
  if (ci == null || ci === '') return ''
  if (typeof ci === 'object' && ci !== null && 'id' in ci) return String(ci.id)
  return String(ci)
}

function coverFilenameFromCourse(c: Course): string | null {
  const ci = c.coverImage
  if (ci && typeof ci === 'object' && 'filename' in ci && typeof (ci as { filename: string }).filename === 'string') {
    return (ci as { filename: string }).filename
  }
  return null
}

interface Module {
  id: string
  title: string
  order: number
  isPublished: boolean
  lessons?: Lesson[]
}

interface Lesson {
  id: string
  title: string
  order: number
  isPublished: boolean
}

export function CourseEditor({ course, modules }: { course: Course; modules: Module[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showAddModule, setShowAddModule] = useState(false)
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([])
  const [courseError, setCourseError] = useState<string>('')
  const [courseFieldErrors, setCourseFieldErrors] = useState<Record<string, string>>({})
  const [moduleError, setModuleError] = useState<string>('')
  const [moduleFieldErrors, setModuleFieldErrors] = useState<Record<string, string>>({})
  const [coverMediaId, setCoverMediaId] = useState(() => coverIdFromCourse(course))
  const [coverFilename, setCoverFilename] = useState<string | null>(() => coverFilenameFromCourse(course))
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(
    () => (Array.isArray(course.publishGroupIds) ? course.publishGroupIds : []),
  )

  const coverSig =
    course.coverImage && typeof course.coverImage === 'object'
      ? `${(course.coverImage as { id: string | number }).id}:${(course.coverImage as { filename?: string }).filename ?? ''}`
      : String(course.coverImage ?? '')

  useEffect(() => {
    queueMicrotask(() => {
      setCoverMediaId(coverIdFromCourse(course))
      setCoverFilename(coverFilenameFromCourse(course))
    })
  }, [course.id, coverSig])

  useEffect(() => {
    let isMounted = true
    const fetchSubjects = async () => {
      try {
        const res = await fetch('/api/subjects')
        if (!res.ok) return
        const data = await res.json()
        if (isMounted && Array.isArray(data.subjects)) {
          setSubjects(data.subjects)
        }
      } catch {
        if (isMounted) setSubjects([])
      }
    }
    void fetchSubjects()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const fetchGroups = async () => {
      try {
        const res = await fetch('/api/admin/groups')
        if (!res.ok) return
        const data = await res.json()
        if (isMounted && Array.isArray(data.groups)) {
          setGroups(data.groups.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })))
        }
      } catch {
        if (isMounted) setGroups([])
      }
    }
    void fetchGroups()
    return () => {
      isMounted = false
    }
  }, [])

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    )
  }


  const handleUpdateCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setCourseError('')
    setCourseFieldErrors({})

    const formData = new FormData(e.currentTarget)
    const data: any = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      subject: formData.get('subject') as string || undefined,
      level: (formData.get('level') as string) || undefined,
      publishGroupIds: selectedGroupIds,
    }

    try {
      // If this editor is for a new (unsaved) course, call createCourse instead
      if (course.id === 'new') {
        // Ensure required fields for creation: slug and level
        const title = (data.title || '').trim()
        const slugFromTitle = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `untitled-${Date.now()}`
        const createPayload = {
          ...data,
          slug: slugFromTitle,
          level: data.level || 'BEGINNER',
          ...(coverMediaId ? { coverImage: coverMediaId } : {}),
        }

        const created = await createCourse(createPayload)
        const newId = created?.id || (created?.course && created.course.id)
        if (newId) {
          // Navigate to the canonical edit page for further editing
          router.push(`/admin/courses/${String(newId)}/edit`)
          return
        }
        // If no id returned, show fallback
        setCourseError('Course created but no id returned')
      } else {
        await updateCourse(course.id, {
          ...data,
          coverImage: coverMediaId || null,
        })
        alert('Course updated!')
        router.refresh()
      }
    } catch (error: any) {
      // Handle Zod validation errors
      if (error?.name === 'ZodError' || error?.issues) {
        const zodError = error as ZodError
        const fieldErrors: Record<string, string> = {}
        const errorMessages: string[] = []
        
        zodError.issues.forEach((issue) => {
          const field = issue.path[0]?.toString() || 'unknown'
          const message = issue.message
          fieldErrors[field] = message
          errorMessages.push(message)
        })
        
        setCourseFieldErrors(fieldErrors)
        setCourseError(errorMessages.join(', '))
      } else {
        setCourseError(error?.message || 'Failed to save course')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddModule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setModuleError('')
    setModuleFieldErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
      title: formData.get('moduleTitle') as string,
      course: course.id,
      order: modules.length + 1,
    }

    try {
      await createModule(data)
      setShowAddModule(false)
      router.refresh()
    } catch (error: any) {
      // Handle Zod validation errors
      if (error?.name === 'ZodError' || error?.issues) {
        const zodError = error as ZodError
        const fieldErrors: Record<string, string> = {}
        const errorMessages: string[] = []
        
        zodError.issues.forEach((issue) => {
          const field = issue.path[0]?.toString() || 'unknown'
          const message = issue.message
          fieldErrors[field] = message
          errorMessages.push(message)
        })
        
        setModuleFieldErrors(fieldErrors)
        setModuleError(errorMessages.join(', '))
      } else {
        setModuleError(error?.message || 'Failed to add module')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className={cn(adminGlassOutlineButton)} asChild>
            <Link href="/admin/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-4xl">{course.title}</h1>
            <p className="mt-1 text-base text-gray-600 dark:text-gray-400 md:text-lg">Edit course and manage modules</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="border-red-300/50 text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-950/30"
          onClick={async () => {
            if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) return
            setLoading(true)
            try {
              await deleteCourse(course.id)
              router.push('/admin/dashboard')
              router.refresh()
            } catch {
              alert('Failed to delete course')
              setLoading(false)
            }
          }}
          disabled={loading}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete course
        </Button>
      </div>

      {/* Course Info */}
      <Card className={cn('border-0 shadow-none', adminGlassCard)}>
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Basic information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateCourse} className="space-y-6">
            {courseError && <FormError message={courseError} />}
            
            <div>
              <Label htmlFor="title" className="text-base font-medium">Title</Label>
              <Input
                id="title"
                name="title"
                defaultValue={course.title}
                className="mt-3 border border-input bg-background dark:bg-background"
              />
              {courseFieldErrors.title && <FieldError message={courseFieldErrors.title} />}
            </div>
            <div>
              <Label htmlFor="description" className="text-base font-medium">Description</Label>
              <textarea
                id="description"
                name="description"
                defaultValue={course.description}
                className="mt-3 min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              {courseFieldErrors.description && <FieldError message={courseFieldErrors.description} />}
            </div>
            <div>
              <Label htmlFor="subject" className="text-base font-medium">Subject</Label>
              <select 
                id="subject" 
                name="subject" 
                defaultValue={typeof course.subject === 'object' ? String((course.subject as any)?.id) : String(course.subject)} 
                className="mt-3 block w-full rounded-md border border-input bg-background p-2 text-sm"
              >
                <option value="">Select a subject</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {courseFieldErrors.subject && <FieldError message={courseFieldErrors.subject} />}
            </div>
            <div>
              <Label htmlFor="level" className="text-base font-medium">Level</Label>
              <select
                id="level"
                name="level"
                defaultValue={course.level || 'BEGINNER'}
                className="mt-3 block w-full rounded-md border border-input bg-background p-2 text-sm"
              >
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
              {courseFieldErrors.level && <FieldError message={courseFieldErrors.level} />}
            </div>

            <div>
              <Label className="text-base font-medium">Course cover image</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Shown on the student dashboard and course page. Optional.
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="relative h-36 w-full max-w-md overflow-hidden rounded-lg border border-border bg-muted/30 dark:bg-muted/20">
                  {coverMediaId && coverFilename ? (
                    <Image
                      src={`/api/media/serve/${encodeURIComponent(coverFilename)}`}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-8 w-8 opacity-50" />
                      <span className="text-sm">No cover selected</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="hero"
                    className="auth-hero-cta"
                    onClick={() => setShowCoverPicker(true)}
                    disabled={loading}
                  >
                    {coverMediaId ? 'Change image' : 'Choose image'}
                  </Button>
                  {coverMediaId ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(adminGlassOutlineButton)}
                      disabled={loading}
                      onClick={() => {
                        setCoverMediaId('')
                        setCoverFilename(null)
                      }}
                    >
                      Remove cover
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Publish to groups</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose which student groups can see this course. Leave all unchecked to publish to
                every group. Remember to Save after changing this.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No groups yet. Create groups under Admin → Groups.
                  </p>
                ) : (
                  groups.map((g) => {
                    const checked = selectedGroupIds.includes(g.id)
                    return (
                      <label
                        key={g.id}
                        className={cn(
                          'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                          checked
                            ? 'border-primary/50 bg-primary/10 text-primary dark:bg-primary/20'
                            : 'border-input bg-background text-foreground hover:bg-muted/40',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={() => toggleGroup(g.id)}
                        />
                        {g.name}
                      </label>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3">
              <Button
                type="button"
                variant="outline"
                className={cn('min-h-10 flex-1', adminGlassOutlineButton)}
                disabled={loading || course.id === 'new'}
                onClick={async () => {
                  setLoading(true)
                  try {
                    await toggleCoursePublish(course.id, !course.isPublished)
                    router.refresh()
                  } catch {
                    alert('Failed to toggle publish')
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                {course.isPublished ? 'Unpublish' : 'Publish'}
              </Button>
              {course.id !== 'new' ? (
                <Button
                  type="button"
                  variant="outline"
                  className={cn('min-h-10 flex-1', adminGlassOutlineButton)}
                  disabled={loading}
                  title="Publish this course and every module, lesson, and task under it"
                  onClick={async () => {
                    if (
                      !confirm(
                        'Publish this course and every module, lesson, and task in it? Students will see the full tree.',
                      )
                    ) {
                      return
                    }
                    setLoading(true)
                    try {
                      await publishCourseTree(course.id)
                      router.refresh()
                    } catch {
                      alert('Failed to publish the full course tree')
                    } finally {
                      setLoading(false)
                    }
                  }}
                >
                  Publish all
                </Button>
              ) : null}
              <Button type="submit" disabled={loading} variant="hero" className="auth-hero-cta min-h-10 flex-1">
                <Save className="mr-2 h-4 w-4" />
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Modules */}
      <Card className={cn('border-0 shadow-none', adminGlassCard)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-900 dark:text-gray-100">Modules ({modules.length})</CardTitle>
            <Button variant="hero" className="auth-hero-cta" onClick={() => setShowAddModule(!showAddModule)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add module
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddModule && (
            <form
              onSubmit={handleAddModule}
              className="space-y-4 rounded-xl border border-slate-300/40 bg-white/[0.22] p-4 backdrop-blur-md dark:border-white/12 dark:bg-white/[0.08]"
            >
              {moduleError && <FormError message={moduleError} />}
              
              <div>
                <Label htmlFor="moduleTitle" className="text-base font-medium">Module title</Label>
                <Input
                  id="moduleTitle"
                  name="moduleTitle"
                  placeholder="e.g. Foundational concepts"
                  required
                  className="mt-3 border border-input bg-background dark:bg-background"
                />
                {moduleFieldErrors.title && <FieldError message={moduleFieldErrors.title} />}
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="hero" className="auth-hero-cta" disabled={loading}>
                  Add
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(adminGlassOutlineButton)}
                  onClick={() => {
                    setShowAddModule(false)
                    setModuleError('')
                    setModuleFieldErrors({})
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          <ModulesList modules={modules} courseId={course.id} />
        </CardContent>
      </Card>

      <MediaPicker
        open={showCoverPicker}
        onClose={() => setShowCoverPicker(false)}
        onSelect={(media) => {
          setCoverMediaId(String(media.id))
          setCoverFilename(media.filename ?? null)
          setShowCoverPicker(false)
        }}
        currentMediaId={coverMediaId || null}
        filter="image"
      />
    </div>
  )
}
