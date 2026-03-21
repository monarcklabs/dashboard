import { auth, currentUser } from '@clerk/nextjs/server'
import { parseRequestHostname, sanitizeReturnTo } from '@/lib/auth/turnstile'

interface ClerkEmailAddress {
  id: string
  emailAddress: string
}

interface ClerkUserLike {
  id: string
  fullName: string | null
  firstName: string | null
  lastName: string | null
  username: string | null
  imageUrl: string
  primaryEmailAddressId: string | null
  primaryEmailAddress?: ClerkEmailAddress | null
  emailAddresses?: ClerkEmailAddress[]
  publicMetadata?: Record<string, unknown>
}

export type DashboardSession = {
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    username: string | null
    role: string | null
    orgId?: string | null
    orgSlug?: string | null
    orgRole?: string | null
  }
}

function getPrimaryEmailAddress(user: ClerkUserLike) {
  if (user.primaryEmailAddress?.emailAddress) {
    return user.primaryEmailAddress.emailAddress
  }

  if (user.primaryEmailAddressId && Array.isArray(user.emailAddresses)) {
    const primary = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    )
    if (primary?.emailAddress) {
      return primary.emailAddress
    }
  }

  return user.emailAddresses?.[0]?.emailAddress || null
}

export function mapClerkUserToSession(user: ClerkUserLike): DashboardSession {
  const metadataRole = user.publicMetadata?.role
  const name =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.username ||
    getPrimaryEmailAddress(user) ||
    'User'

  return {
    user: {
      id: user.id,
      name,
      email: getPrimaryEmailAddress(user),
      image: user.imageUrl || null,
      username: user.username,
      role: typeof metadataRole === 'string' ? metadataRole : null,
    },
  }
}

export async function getCurrentSession(): Promise<DashboardSession | null> {
  const authState = await auth()
  const { userId } = authState
  if (!userId) {
    return null
  }

  const user = await currentUser()
  if (!user) {
    return null
  }

  const baseSession = mapClerkUserToSession(user as ClerkUserLike)

  return {
    ...baseSession,
    user: {
      ...baseSession.user,
      orgId: authState.orgId ?? null,
      orgSlug: authState.orgSlug ?? null,
      orgRole: authState.orgRole ?? null,
    },
  }
}

export function getLoginUrl(nextPath: string) {
  const callbackUrl = sanitizeReturnTo(nextPath)
  return `/login?next=${encodeURIComponent(callbackUrl)}`
}

export function getRequestHost(headers: Headers): string {
  return (
    parseRequestHostname(headers.get('x-forwarded-host')) ||
    parseRequestHostname(headers.get('host'))
  )
}
