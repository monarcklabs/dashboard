import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { handleProxy } from '@/proxy'

describe('auth proxy', () => {
  it('redirects unauthenticated page requests to login', async () => {
    const response = await handleProxy(
      async () => ({ userId: null }),
      new NextRequest('http://localhost:3000/chat'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login?next=%2Fchat')
  })

  it('allows authenticated requests through', async () => {
    const response = await handleProxy(
      async () => ({ userId: 'user_1' }),
      new NextRequest('http://localhost:3000/chat'),
    )

    expect(response.status).toBe(200)
  })

  it('redirects authenticated users away from the login page', async () => {
    const response = await handleProxy(
      async () => ({ userId: 'user_1' }),
      new NextRequest('http://localhost:3000/login?next=%2Fchat'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/chat')
  })

  it('blocks signed-in users when the deployment org does not match the active org', async () => {
    process.env.CLIENT_ORG_SLUG = 'acme'

    const response = await handleProxy(
      async () => ({ userId: 'user_1', orgSlug: 'globex' }),
      new NextRequest('http://localhost:3000/chat'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/unauthorized?requiredOrg=acme&activeOrg=globex')

    delete process.env.CLIENT_ORG_SLUG
  })

  it('allows signed-in users when the deployment org matches the active org', async () => {
    process.env.CLIENT_ORG_SLUG = 'acme'

    const response = await handleProxy(
      async () => ({ userId: 'user_1', orgSlug: 'acme' }),
      new NextRequest('http://localhost:3000/chat'),
    )

    expect(response.status).toBe(200)

    delete process.env.CLIENT_ORG_SLUG
  })
})
