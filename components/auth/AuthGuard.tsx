'use client'

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { usePathname, useRouter } from 'next/navigation'

const PUBLIC_PATHS = new Set(['/login', '/unauthorized', '/clerk-sync-keyless'])

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isPublic = PUBLIC_PATHS.has(pathname)

  useEffect(() => {
    if (isLoaded && !isSignedIn && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [isLoaded, isSignedIn, isPublic, pathname, router])

  // Still loading Clerk — show nothing to avoid flash
  if (!isLoaded) {
    return null
  }

  // Not signed in on a protected route — show nothing while redirecting
  if (!isSignedIn && !isPublic) {
    return null
  }

  return <>{children}</>
}
