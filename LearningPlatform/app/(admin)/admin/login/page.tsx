'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { adminGlassCard } from '@/lib/student-glass-styles'

export default function AdminLoginPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = () => {
    setIsLoading(true)
    void signIn('roblox', { callbackUrl: '/admin/dashboard' })
  }

  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center px-4">
      <div className="student-app-shell-bg" aria-hidden />
      <Card className={cn('relative z-[1] w-full max-w-md border-0 shadow-none', adminGlassCard)}>
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold text-gray-900 dark:text-gray-100">Admin sign in</CardTitle>
          <CardDescription className="text-center">
            Continue with your Roblox account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="hero"
            className="auth-hero-cta w-full"
            disabled={isLoading}
            onClick={handleSignIn}
          >
            {isLoading ? 'Redirecting…' : 'Sign in with Roblox'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
