import { getCourseById, getModulesByCourse } from '../../../actions'
import { CourseEditor } from '@/components/admin/course-editor'

export const dynamic = 'force-dynamic'

interface CourseShape {
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

export default async function CourseEditPage(props: any) {
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'
  if (isBuildTime) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">Course editing not available during build.</p>
      </div>
    )
  }

  const { courseId } = (await props.params) as { courseId: string }

  const courseData = await getCourseById(courseId)
  if (!courseData) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">Course not found.</p>
      </div>
    )
  }

  const modulesData = await getModulesByCourse(courseId)

  // Normalize course shape expected by CourseEditor
  const course: CourseShape = {
    id: String(courseData.id),
    title: courseData.title,
    slug: courseData.slug,
    description: courseData.description,
    subject: courseData.subject,
    level: courseData.level,
    isPublished: Boolean(courseData.isPublished),
    topics: Array.isArray(courseData.topics) ? courseData.topics : [],
    publishGroupIds: Array.isArray((courseData as { publishGroupIds?: unknown }).publishGroupIds)
      ? ((courseData as { publishGroupIds?: unknown }).publishGroupIds as unknown[]).filter(
          (v): v is string => typeof v === 'string',
        )
      : [],
    coverImage: courseData.coverImage as CourseShape['coverImage'],
  }

  const modules = Array.isArray(modulesData)
    ? modulesData.map((m: any) => ({
        id: String(m.id),
        title: m.title,
        order: m.order,
        isPublished: Boolean(m.isPublished),
        lessons: Array.isArray(m.lessons) ? m.lessons : [],
      }))
    : []

  return <CourseEditor course={course} modules={modules} />
}
