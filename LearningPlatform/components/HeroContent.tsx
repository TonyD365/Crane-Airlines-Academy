"use client"
import useIsDark from './useIsDark'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { heroMarketingBodyClass, heroMarketingGlassText } from '@/lib/hero-marketing-classes'

/** Live hero title: Outfit via `font-hero`, same glass gradient as the brand. */
const titleMetrics =
  'font-extrabold tracking-tight text-5xl sm:text-6xl md:text-7xl md:tracking-tighter relative inline-block overflow-visible px-[0.12em]'

export default function HeroContent() {
  const isDark = useIsDark()
  const glass = heroMarketingGlassText(isDark)

  const heroTextClass = isDark ? 'text-white' : 'text-gray-900'

  return (
    <div className={cn('text-center', heroTextClass)}>
      <h1 className="mb-8 flex w-full min-w-0 justify-center overflow-visible px-2 text-center">
        <span
          className={cn(
            'font-hero',
            titleMetrics,
            glass,
          )}
        >
          Crane Airlines Academy
        </span>
      </h1>
      <p className={cn('mb-8', heroMarketingBodyClass(isDark))}>
        Platform for courses, lessons, and interactive learning content.
      </p>
      <div className="flex justify-center items-center gap-4">
        <Button asChild size="lg" variant="hero">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  )
}
