import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { NavigationMetrics } from '@/components/perf/navigation-metrics'
import { PrefetchRoutes } from '@/components/perf/prefetch-routes'
import { ThemePreferenceProvider } from '@/components/theme-preference-provider'
import { THEME_COOKIE_NAME, readThemeFromCookie } from '@/lib/theme-cookie'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "latin-ext"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "Crane Airlines Academy",
  description: "Crane Airlines Academy: courses, lessons, and learning content management.",
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeCookie = (await cookies()).get(THEME_COOKIE_NAME)?.value
  const themePref = readThemeFromCookie(themeCookie)
  const isDark = themePref === 'dark'

  return (
    <html lang="en" className={isDark ? 'dark' : undefined} suppressHydrationWarning>
      <head>
        {/* Explicit favicon link to ensure the app/favicon.ico is used */}
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}
      >
        <ThemePreferenceProvider initialPreference={themePref}>
          <NavigationMetrics />
          <PrefetchRoutes />
          {children}
        </ThemePreferenceProvider>
      </body>
    </html>
  );
}
