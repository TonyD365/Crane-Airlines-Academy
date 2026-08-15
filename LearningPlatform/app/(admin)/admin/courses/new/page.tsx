import { CourseEditor } from '@/components/admin/course-editor'

export const dynamic = 'force-dynamic'

export default function NewCoursePage() {
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'
  if (isBuildTime) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">Course editing not available during build.</p>
      </div>
    )
  }

  const course = {
    id: 'new',
    title: 'New course',
    slug: '',
    description: '',
    subject: '',
    level: '',
    isPublished: false,
    topics: [],
    publishGroupIds: [],
  }

  const modules: any[] = []

  return <CourseEditor course={course} modules={modules} />
}
