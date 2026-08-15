'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DarkBackground from '@/components/DarkBackground';
import useIsDark from '@/components/useIsDark';
import ThemeToggle from '@/components/theme-toggle';
import Link from 'next/link';
import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { heroMarketingAuthInputClass, heroMarketingGlassText } from '@/lib/hero-marketing-classes';

const INFRA_STATUS_CACHE_TTL_MS = 30_000;
let lastInfraStatusCheckAt = 0;
let lastInfraStatusMessage: string | null = null;

async function getInfraStatusMessage(): Promise<string | null> {
  const now = Date.now();
  if (now - lastInfraStatusCheckAt < INFRA_STATUS_CACHE_TTL_MS) {
    return lastInfraStatusMessage;
  }

  try {
    const res = await fetch('/api/healthz', { cache: 'no-store' });
    const message =
      res.ok || res.status < 500
        ? null
        : 'Cannot connect to the server/database right now. Please try again in a moment.';
    lastInfraStatusCheckAt = now;
    lastInfraStatusMessage = message;
    return message;
  } catch {
    const message = 'Cannot reach the backend right now. Check your connection and try again.';
    lastInfraStatusCheckAt = now;
    lastInfraStatusMessage = message;
    return message;
  }
}

function LoginForm() {
  const isDark = useIsDark();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  // Prevent open redirect: only allow relative paths starting with /
  // Disallow protocol-relative URLs like //evil.com
  const safeCallbackUrl =
    typeof callbackUrl === 'string' &&
    callbackUrl.startsWith('/') &&
    !callbackUrl.startsWith('//')
      ? callbackUrl
      : '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Fast-fail before credential check so infra outages are not mislabeled
      // as "invalid email/password".
      const precheckInfraMessage = await getInfraStatusMessage();
      if (precheckInfraMessage) {
        setError(precheckInfraMessage);
        return;
      }

      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        const infraMessage = await getInfraStatusMessage();
        if (infraMessage) {
          setError(infraMessage);
        } else if (result.error.toLowerCase().includes('too many')) {
          setError('Too many login attempts. Please try again later.');
        } else {
          setError('Invalid username or password');
        }
      } else {
        router.push(safeCallbackUrl);
        router.refresh();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const glass = heroMarketingGlassText(isDark)
  const fieldLabelClass = isDark ? glass : 'font-medium text-slate-800'
  const fieldInputClass = heroMarketingAuthInputClass(isDark)

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md bg-white/10 dark:bg-white/10 backdrop-blur-lg border border-white/20">
          <CardHeader className="space-y-1">
            <CardTitle className={cn('text-2xl font-bold text-center', glass)}>Sign in</CardTitle>
            <CardDescription className={cn('text-center', glass)}>
              Enter your details to continue
            </CardDescription>
          </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className={fieldLabelClass}>
                RBX Username
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="your-rbx-username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                className={fieldInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className={fieldLabelClass}>
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className={fieldInputClass}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mx-auto w-full max-w-[280px]">
              <Button type="submit" variant="hero" size="lg" className="auth-hero-cta w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className={cn(glass)}>
              Accounts are created by an administrator. Contact your admin for access.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  const isDark = useIsDark()

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

          <div className="relative z-10">
            <LoginForm />
          </div>
        </div>
      </Suspense>
    </>
  );
}
