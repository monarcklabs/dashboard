import { afterEach, describe, expect, it, vi } from 'vitest'
import { authIsConfigured, getLoginProviderUrl } from '@/lib/auth'

describe('auth helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('detects when authentik auth is configured', () => {
    vi.stubEnv('AUTHENTIK_ISSUER', 'https://auth.example.com/application/o/clawport')
    vi.stubEnv('AUTHENTIK_CLIENT_ID', 'client-id')
    vi.stubEnv('AUTHENTIK_CLIENT_SECRET', 'client-secret')
    vi.stubEnv('NEXTAUTH_SECRET', 'secret')

    expect(authIsConfigured()).toBe(true)
  })

  it('builds the authentik sign-in url with a callback path', () => {
    expect(getLoginProviderUrl('/chat')).toBe('/api/auth/signin/authentik?callbackUrl=%2Fchat')
    expect(getLoginProviderUrl('https://evil.test')).toBe('/api/auth/signin/authentik?callbackUrl=%2F')
  })
})
