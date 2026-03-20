import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}))

import { getToken } from 'next-auth/jwt'
import { proxy } from '@/proxy'

describe('auth proxy', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('returns a configuration error when authentik is not configured', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/chat'))
    expect(response.status).toBe(500)
  })

  it('redirects unauthenticated page requests to login', async () => {
    vi.stubEnv('AUTHENTIK_ISSUER', 'https://auth.example.com/application/o/app/')
    vi.stubEnv('AUTHENTIK_CLIENT_ID', 'client-id')
    vi.stubEnv('AUTHENTIK_CLIENT_SECRET', 'client-secret')
    vi.stubEnv('NEXTAUTH_SECRET', 'secret')
    vi.mocked(getToken).mockResolvedValue(null)

    const response = await proxy(new NextRequest('http://localhost:3000/chat'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login?next=%2Fchat')
  })

  it('allows authenticated requests through', async () => {
    vi.stubEnv('AUTHENTIK_ISSUER', 'https://auth.example.com/application/o/app/')
    vi.stubEnv('AUTHENTIK_CLIENT_ID', 'client-id')
    vi.stubEnv('AUTHENTIK_CLIENT_SECRET', 'client-secret')
    vi.stubEnv('NEXTAUTH_SECRET', 'secret')
    vi.mocked(getToken).mockResolvedValue({ sub: 'user-1' } as never)

    const response = await proxy(new NextRequest('http://localhost:3000/chat'))
    expect(response.status).toBe(200)
  })
})
