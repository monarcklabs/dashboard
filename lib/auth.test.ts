import { describe, expect, it } from 'vitest'
import { getLoginUrl, mapClerkUserToSession } from '@/lib/auth'

describe('auth helpers', () => {
  it('maps Clerk users into the dashboard session shape', () => {
    const session = mapClerkUserToSession({
      id: 'user_123',
      fullName: 'Rich Rosales',
      firstName: 'Rich',
      lastName: 'Rosales',
      username: 'richrosales',
      imageUrl: 'https://example.com/avatar.png',
      primaryEmailAddressId: 'email_1',
      primaryEmailAddress: {
        id: 'email_1',
        emailAddress: 'rich@monarck.ai',
      },
      emailAddresses: [],
      publicMetadata: {
        role: 'admin',
      },
    })

    expect(session).toEqual({
      user: {
        id: 'user_123',
        name: 'Rich Rosales',
        email: 'rich@monarck.ai',
        image: 'https://example.com/avatar.png',
        username: 'richrosales',
        role: 'admin',
      },
    })
  })

  it('builds the login url with a sanitized callback path', () => {
    expect(getLoginUrl('/chat')).toBe('/login?next=%2Fchat')
    expect(getLoginUrl('https://evil.test')).toBe('/login?next=%2F')
  })
})
