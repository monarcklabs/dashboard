import { getServerSession, type DefaultSession, type NextAuthOptions } from 'next-auth'
import { parseRequestHostname } from '@/lib/auth/turnstile'

type AuthentikProfile = {
  sub?: string
  email?: string
  name?: string
  preferred_username?: string
  groups?: string[]
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export type DashboardSession = DefaultSession & {
  user: DefaultSession['user'] & {
    id?: string
    username?: string | null
    role?: string | null
  }
}

export function buildAuthOptions(): NextAuthOptions {
  return {
    providers: [
      {
        id: 'authentik',
        name: 'authentik',
        type: 'oauth',
        wellKnown: `${requiredEnv('AUTHENTIK_ISSUER')}/.well-known/openid-configuration`,
        clientId: requiredEnv('AUTHENTIK_CLIENT_ID'),
        clientSecret: requiredEnv('AUTHENTIK_CLIENT_SECRET'),
        authorization: { params: { scope: 'openid profile email' } },
        checks: ['pkce', 'state'],
        profile(profile: AuthentikProfile) {
          const username = profile.preferred_username || profile.email || profile.sub || 'user'
          return {
            id: profile.sub || username,
            name: profile.name || username,
            email: profile.email || null,
            image: null,
            username,
            role: profile.groups?.[0] || null,
          }
        },
      },
    ],
    session: {
      strategy: 'jwt',
    },
    pages: {
      signIn: '/login',
    },
    callbacks: {
      async jwt({ token, user, profile }) {
        if (user) {
          token.sub = user.id
          token.name = user.name
          token.email = user.email
          token.picture = user.image
          token.username = (user as { username?: string }).username ?? null
          token.role = (user as { role?: string | null }).role ?? null
        }

        if (profile) {
          const authentikProfile = profile as AuthentikProfile
          token.username =
            authentikProfile.preferred_username ||
            token.username ||
            token.email ||
            token.sub ||
            null
          token.role =
            authentikProfile.groups?.[0] ||
            token.role ||
            null
        }

        return token
      },
      async session({ session, token }) {
        return {
          ...session,
          user: {
            ...session.user,
            id: token.sub,
            username: typeof token.username === 'string' ? token.username : null,
            role: typeof token.role === 'string' ? token.role : null,
          },
        } satisfies DashboardSession
      },
      async redirect({ url, baseUrl }) {
        if (url.startsWith('/')) return `${baseUrl}${url}`
        if (url.startsWith(baseUrl)) return url
        return baseUrl
      },
    },
    secret: process.env.NEXTAUTH_SECRET,
  }
}

export function getCurrentSession() {
  return getServerSession(buildAuthOptions()) as Promise<DashboardSession | null>
}

export function getLoginProviderUrl(nextPath: string) {
  const callbackUrl = nextPath.startsWith('/') ? nextPath : '/'
  return `/api/auth/signin/authentik?callbackUrl=${encodeURIComponent(callbackUrl)}`
}

export function getRequestHost(headers: Headers): string {
  return (
    parseRequestHostname(headers.get('x-forwarded-host')) ||
    parseRequestHostname(headers.get('host'))
  )
}

export function authIsConfigured() {
  return Boolean(
    process.env.AUTHENTIK_ISSUER?.trim() &&
    process.env.AUTHENTIK_CLIENT_ID?.trim() &&
    process.env.AUTHENTIK_CLIENT_SECRET?.trim() &&
    process.env.NEXTAUTH_SECRET?.trim(),
  )
}
