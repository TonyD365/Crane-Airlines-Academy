import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { isManagerRole, isStaffRole } from '@/lib/roles';

export const dynamic = 'force-dynamic'
import DarkBackground from '@/components/DarkBackground';
import HeroContent from '@/components/HeroContent';
import ThemeToggle from '@/components/theme-toggle';

export default async function HomePage() {
  // Check if user is already logged in
  const session = await auth();
  
  // If logged in, redirect to appropriate dashboard
  if (session?.user) {
    // Safe guard: check if role exists
    const userRole = session.user?.role;
    if (!userRole) {
      // No role assigned - redirect to login to re-authenticate
      redirect('/login');
    }
    
    if (isManagerRole(userRole)) {
      redirect('/admin/dashboard');
    } else if (isStaffRole(userRole)) {
      // Trainers only have the completion view.
      redirect('/admin/completion');
    } else {
      redirect('/courses');
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center">
      <DarkBackground />

      {/* Fixed top-right: theme toggle only */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Hero centered both horizontally and vertically */}
      <div className="relative z-10 w-full max-w-5xl px-4 mx-auto">
        <HeroContent />
      </div>
    </div>
  );
}
