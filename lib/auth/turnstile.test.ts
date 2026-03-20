import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getTurnstileWidgetConfigForHostname,
  hostnameMatchesRule,
  parseRequestHostname,
  verifyTurnstileToken,
} from '@/lib/auth/turnstile'

describe('turnstile config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('normalizes request hostnames', () => {
    expect(parseRequestHostname('App.Monarck.ai:443')).toBe('app.monarck.ai')
    expect(parseRequestHostname('[::1]:3000')).toBe('::1')
  })

  it('treats an apex rule as matching subdomains', () => {
    expect(hostnameMatchesRule('app.monarck.ai', 'monarck.ai')).toBe(true)
    expect(hostnameMatchesRule('monarck.ai', 'monarck.ai')).toBe(true)
    expect(hostnameMatchesRule('api.other.ai', 'monarck.ai')).toBe(false)
  })

  it('enables turnstile for explicitly allowed hostnames', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-key')
    vi.stubEnv('TURNSTILE_ALLOWED_HOSTNAMES', 'monarck.ai,app.partner.ai')

    expect(getTurnstileWidgetConfigForHostname('dashboard.monarck.ai')).toEqual({
      siteKey: 'site-key',
      allowedHostnames: ['monarck.ai', 'app.partner.ai'],
    })
  })

  it('disables turnstile on localhost when no allowlist is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-key')

    expect(getTurnstileWidgetConfigForHostname('localhost:3000')).toBeNull()
    expect(getTurnstileWidgetConfigForHostname('127.0.0.1:3000')).toBeNull()
  })

  it('verifies turnstile tokens against the request hostname', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-key')
    vi.stubEnv('TURNSTILE_ALLOWED_HOSTNAMES', 'monarck.ai')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          hostname: 'app.monarck.ai',
          action: 'login',
        }),
      }),
    )

    await expect(
      verifyTurnstileToken({
        token: 'token',
        requestHeaders: new Headers({ host: 'app.monarck.ai' }),
      }),
    ).resolves.toEqual({ ok: true })
  })

  it('rejects hostname mismatches from siteverify', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key')
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-key')
    vi.stubEnv('TURNSTILE_ALLOWED_HOSTNAMES', 'monarck.ai')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          hostname: 'evil.example.com',
          action: 'login',
        }),
      }),
    )

    await expect(
      verifyTurnstileToken({
        token: 'token',
        requestHeaders: new Headers({ host: 'app.monarck.ai' }),
      }),
    ).resolves.toEqual({
      ok: false,
      message: 'Turnstile hostname validation failed.',
    })
  })
})
