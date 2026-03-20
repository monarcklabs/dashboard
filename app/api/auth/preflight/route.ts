export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getLoginProviderUrl } from '@/lib/auth'
import {
  PREAUTH_COOKIE_NAME,
  getPreauthCookieOptions,
  sanitizeReturnTo,
  verifyTurnstileToken,
} from '@/lib/auth/turnstile'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const payload = (body ?? {}) as Record<string, unknown>
  const nextPath = sanitizeReturnTo(
    typeof payload.nextPath === 'string' ? payload.nextPath : '/',
  )
  const turnstileToken =
    typeof payload.turnstileToken === 'string' ? payload.turnstileToken : ''

  const turnstileResult = await verifyTurnstileToken({
    token: turnstileToken,
    requestHeaders: request.headers,
  })

  if (!turnstileResult.ok) {
    return NextResponse.json({ error: turnstileResult.message }, { status: 400 })
  }

  const response = NextResponse.json({
    ok: true,
    redirectTo: getLoginProviderUrl(nextPath),
  })
  response.cookies.set(PREAUTH_COOKIE_NAME, '1', getPreauthCookieOptions())
  return response
}
