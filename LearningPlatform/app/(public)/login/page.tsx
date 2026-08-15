'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DarkBackground from '@/components/DarkBackground';
import useIsDark from '@/components/useIsDark';
import ThemeToggle from '@/components/theme-toggle';
import Link from 'next/link';
import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { heroMarketingGlassText } from '@/lib/hero-marketing-classes';

function LoginForm() {
  const isDark = useIsDark();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  // Prevent open redirect: only allow relative paths starting with a single /.
  const safeCallbackUrl =
    typeof callbackUrl === 'string' &&
    callbackUrl.startsWith('/') &&
    !callbackUrl.startsWith('//')
      ? callbackUrl
      : '/dashboard';

  // Auth.js appends ?error=... on the sign-in page when a sign-in is rejected.
  const authError = searchParams.get('error');
  const errorMessage = authError
    ? authError === 'AccessDenied'
      ? 'This Roblox account is not registered. Ask an administrator to create your account.'
      : 'Could not sign you in with Roblox. Please try again.'
    : '';

  const handleSignIn = () => {
    setIsLoading(true);
    void signIn('roblox', { callbackUrl: safeCallbackUrl });
  };

  const glass = heroMarketingGlassText(isDark);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md bg-white/10 dark:bg-white/10 backdrop-blur-lg border border-white/20">
        <CardHeader className="space-y-1">
          <CardTitle className={cn('text-2xl font-bold text-center', glass)}>Sign in</CardTitle>
          <CardDescription className={cn('text-center', glass)}>
            Continue with your Roblox account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {errorMessage}
            </div>
          )}

          <Button
            type="button"
            variant="hero"
            size="lg"
            className="auth-hero-cta w-full"
            disabled={isLoading}
            onClick={handleSignIn}
          >
            {isLoading ? 'Redirecting…' : 'Sign in with Roblox'}
          </Button>

          <p className={cn('text-center text-sm', glass)}>
            Accounts are created by an administrator. Contact your admin for access.
          </p>

          <p className={cn('text-center text-xs', glass)}>
            <Link href="/privacy" className="underline underline-offset-2 hover:opacity-80">
              Privacy Policy
            </Link>
            <span className="mx-2 opacity-60">·</span>
            <Link href="/terms" className="underline underline-offset-2 hover:opacity-80">
              Terms of Service
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  const isDark = useIsDark();

  return (
    <>
      {/* Fixed top-right: theme toggle + home icon */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="icon-xl" asChild aria-label="Go to home">
          <Link href="/">
            <Home className={cn('size-6', !isDark && 'text-gray-900')} />
          </Link>
        </Button>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <div className="relative min-h-screen">
          <DarkBackground />
          <LoginForm />
        </div>
      </Suspense>
    </>
  );
}
