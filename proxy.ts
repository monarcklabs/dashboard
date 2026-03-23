import { NextRequest, NextResponse } from 'next/server'

/**
 * Pass-through proxy — auth is handled at the layout level via Clerk's
 * server-side auth() instead of clerkMiddleware, which crashes in the
 * Next.js 16 middleware worker on this deployment target.
 *
 * We forward the request URL as a header so the layout-level auth guard
 * can determine the current pathname for public/protected routing.
 */
export default function middleware(request: NextRequest) {
  const response = NextResponse.next()
  response.headers.set('x-url', request.url)
  return response
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
