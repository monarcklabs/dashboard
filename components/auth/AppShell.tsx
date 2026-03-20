'use client'

import { usePathname } from 'next/navigation'
import type { DashboardSession } from '@/lib/auth'
import { AgentsProvider } from '@/app/agents-provider'
import { Sidebar } from '@/components/Sidebar'
import { DynamicFavicon } from '@/components/DynamicFavicon'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { LiveStreamWidget } from '@/components/LiveStreamWidget'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function AppShell({
  children,
  session,
}: {
  children: React.ReactNode
  session: DashboardSession | null
}) {
  const pathname = usePathname()
  const isLoginRoute = pathname === '/login'

  if (isLoginRoute) {
    return (
      <>
        <DynamicFavicon />
        {children}
      </>
    )
  }

  return (
    <>
      <DynamicFavicon />
      <AgentsProvider>
        <OnboardingWizard />
        <LiveStreamWidget />
        <div
          className="flex h-screen overflow-hidden"
          style={{ background: 'var(--bg)' }}
        >
          <Sidebar session={session} />
          <main className="flex-1 overflow-hidden relative">
            <div className="md:hidden" style={{ height: '48px', flexShrink: 0 }} />
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </AgentsProvider>
    </>
  )
}
