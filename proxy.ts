import { NextRequest, NextResponse } from 'next/server'
import { clerkMiddleware } from '@clerk/nextjs/server'
import { sanitizeReturnTo } from '@/lib/auth/turnstile'

export interface ProxyAuthResult {
  userId: string | null
  orgSlug?: string | null
}

export type ProxyAuth = () => Promise<ProxyAuthResult>

function getRequiredClientOrgSlug() {
  return process.env.CLIENT_ORG_SLUG?.trim().toLowerCase() || ''
}

function isPublicPath(pathname: string): boolean {
  if (pathname === '/login') return true
  if (pathname === '/unauthorized') return true
  if (pathname === '/api/auth/preflight') return true
  if (pathname === '/clerk-sync-keyless') return true
  return false
}

export async function handleProxy(auth: ProxyAuth, request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const authState = await auth()

  if (isPublicPath(pathname)) {
    if (pathname === '/login') {
      const { userId } = authState
      if (userId) {
        const nextPath = sanitizeReturnTo(request.nextUrl.searchParams.get('next'))
        return NextResponse.redirect(new URL(nextPath, request.url))
      }
    }

    return NextResponse.next()
  }

  const { userId } = authState
  if (userId) {
    const requiredOrgSlug = getRequiredClientOrgSlug()
    const activeOrgSlug = authState.orgSlug?.toLowerCase() || ''

    if (requiredOrgSlug && activeOrgSlug !== requiredOrgSlug) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            requiredOrg: requiredOrgSlug,
            activeOrg: activeOrgSlug || null,
          },
          { status: 403 },
        )
      }

      const unauthorizedUrl = new URL('/unauthorized', request.url)
      unauthorizedUrl.searchParams.set('requiredOrg', requiredOrgSlug)
      if (activeOrgSlug) {
        unauthorizedUrl.searchParams.set('activeOrg', activeOrgSlug)
      }
      return NextResponse.redirect(unauthorizedUrl)
    }

    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set(
    'next',
    sanitizeReturnTo(`${pathname}${request.nextUrl.search}`),
  )
  return NextResponse.redirect(loginUrl)
}

export default clerkMiddleware((auth, request) => handleProxy(auth, request))

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
