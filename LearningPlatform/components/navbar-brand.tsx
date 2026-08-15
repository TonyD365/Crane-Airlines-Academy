'use client'

import Link from 'next/link'
import useIsDark from '@/components/useIsDark'
import { cn } from '@/lib/utils'
import { heroMarketingGlassText } from '@/lib/hero-marketing-classes'

export function NavbarBrand() {
  const isDark = useIsDark()
  return (
    <Link
      href="/dashboard"
      className={cn(
        'font-hero text-3xl font-bold tracking-tight sm:text-4xl',
        heroMarketingGlassText(isDark),
      )}
    >
      Crane Airlines Academy
    </Link>
  )
}
