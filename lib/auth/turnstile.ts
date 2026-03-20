export interface TurnstileWidgetConfig {
  siteKey: string
  allowedHostnames: string[]
}

export const PREAUTH_COOKIE_NAME = 'clawport_auth_preauth'

export interface TurnstileValidationResult {
  success: boolean
  'error-codes'?: string[]
  hostname?: string
  action?: string
}

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const LOGIN_ACTION = 'login'

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '')
}

function stripPort(hostname: string): string {
  if (hostname.startsWith('[')) {
    const end = hostname.indexOf(']')
    return end >= 0 ? hostname.slice(1, end) : hostname
  }

  return hostname.split(':')[0]
}

function isIpv4Private(hostname: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false
  const parts = hostname.split('.').map(Number)
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  )
}

function isLocalHostname(hostname: string): boolean {
  const normalized = normalizeHostname(stripPort(hostname))
  return (
    normalized === 'localhost' ||
    normalized === '0.0.0.0' ||
    normalized === '::1' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    isIpv4Private(normalized)
  )
}

export function parseRequestHostname(input: string | null | undefined): string {
  if (!input) return ''
  return normalizeHostname(stripPort(input))
}

export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value) return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  return value
}

export function hostnameMatchesRule(hostname: string, rule: string): boolean {
  const normalizedHost = normalizeHostname(hostname)
  const normalizedRule = normalizeHostname(rule)

  return (
    normalizedHost === normalizedRule ||
    normalizedHost.endsWith(`.${normalizedRule}`)
  )
}

function parseAllowedHostnames(): string[] {
  const raw = process.env.TURNSTILE_ALLOWED_HOSTNAMES?.trim()
  if (!raw) return []

  return raw
    .split(',')
    .map((entry) => parseRequestHostname(entry))
    .filter(Boolean)
}

export function getTurnstileWidgetConfigForHostname(
  hostname: string,
): TurnstileWidgetConfig | null {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim()
  const normalizedHostname = parseRequestHostname(hostname)

  if (!siteKey || !secretKey || !normalizedHostname) {
    return null
  }

  const allowedHostnames = parseAllowedHostnames()
  if (allowedHostnames.length > 0) {
    return allowedHostnames.some((rule) => hostnameMatchesRule(normalizedHostname, rule))
      ? { siteKey, allowedHostnames }
      : null
  }

  if (isLocalHostname(normalizedHostname)) {
    return null
  }

  return { siteKey, allowedHostnames: [normalizedHostname] }
}

function getClientIp(headers: Headers): string | null {
  const cfIp = headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  const forwardedFor = headers.get('x-forwarded-for')
  if (!forwardedFor) return null

  return forwardedFor.split(',')[0]?.trim() || null
}

export async function verifyTurnstileToken({
  token,
  requestHeaders,
}: {
  token: string
  requestHeaders: Headers
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const hostname =
    parseRequestHostname(requestHeaders.get('x-forwarded-host')) ||
    parseRequestHostname(requestHeaders.get('host'))

  const widgetConfig = getTurnstileWidgetConfigForHostname(hostname)
  if (!widgetConfig) {
    return { ok: true }
  }

  if (!token) {
    return { ok: false, message: 'Complete the Turnstile check and try again.' }
  }

  const formData = new FormData()
  formData.set('secret', process.env.TURNSTILE_SECRET_KEY!.trim())
  formData.set('response', token)

  const clientIp = getClientIp(requestHeaders)
  if (clientIp) {
    formData.set('remoteip', clientIp)
  }

  let result: TurnstileValidationResult
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
      cache: 'no-store',
    })

    result = await response.json() as TurnstileValidationResult
  } catch {
    return { ok: false, message: 'Turnstile verification could not be completed.' }
  }

  if (!result.success) {
    return { ok: false, message: 'Turnstile verification failed. Please try again.' }
  }

  const verifiedHostname = parseRequestHostname(result.hostname)
  if (!verifiedHostname || verifiedHostname !== hostname) {
    return { ok: false, message: 'Turnstile hostname validation failed.' }
  }

  if (result.action && result.action !== LOGIN_ACTION) {
    return { ok: false, message: 'Turnstile action validation failed.' }
  }

  if (
    widgetConfig.allowedHostnames.length > 0 &&
    !widgetConfig.allowedHostnames.some((rule) => hostnameMatchesRule(verifiedHostname, rule))
  ) {
    return { ok: false, message: 'Turnstile hostname is not allowed.' }
  }

  return { ok: true }
}

export function getPreauthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60,
  }
}
