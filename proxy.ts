import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { authIsConfigured } from '@/lib/auth'
import {
  PREAUTH_COOKIE_NAME,
  getTurnstileWidgetConfigForHostname,
  parseRequestHostname,
  sanitizeReturnTo,
} from '@/lib/auth/turnstile'

function isPublicPath(pathname: string): boolean {
  if (pathname === '/login') return true
  if (pathname === '/api/auth/preflight') return true
  if (pathname.startsWith('/api/auth/callback/')) return true
  if (pathname === '/api/auth/error') return true
  if (pathname === '/api/auth/session') return true
  if (pathname === '/api/auth/signout') return true
  if (pathname === '/api/auth/csrf') return true
  if (pathname === '/api/auth/providers') return true
  return false
}

function configurationErrorResponse(request: NextRequest, message: string) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return new NextResponse(message, {
    status: 500,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function proxy(request: NextRequest) {
  if (!authIsConfigured()) {
    return configurationErrorResponse(
      request,
      'Authentik is not configured for this deployment.',
    )
  }

  const pathname = request.nextUrl.pathname
  const hostname =
    parseRequestHostname(request.headers.get('x-forwarded-host')) ||
    parseRequestHostname(request.headers.get('host'))
  const turnstileEnabled = Boolean(getTurnstileWidgetConfigForHostname(hostname))

  if (pathname.startsWith('/api/auth/signin/')) {
    if (!turnstileEnabled || request.cookies.get(PREAUTH_COOKIE_NAME)?.value === '1') {
      const response = NextResponse.next()
      if (turnstileEnabled) {
        response.cookies.set(PREAUTH_COOKIE_NAME, '', {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 0,
        })
      }
      return response
    }

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set(
      'next',
      sanitizeReturnTo(request.nextUrl.searchParams.get('callbackUrl') || '/'),
    )
    return NextResponse.redirect(loginUrl)
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (isPublicPath(pathname)) {
    if (pathname === '/login' && token) {
      const nextPath = sanitizeReturnTo(request.nextUrl.searchParams.get('next'))
      return NextResponse.redirect(new URL(nextPath, request.url))
    }
    return NextResponse.next()
  }

  if (token) {
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

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
}
