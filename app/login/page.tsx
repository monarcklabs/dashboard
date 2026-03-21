import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Loader2 } from 'lucide-react'
import { Show } from '@clerk/nextjs'
import { LoginForm } from '@/components/auth/LoginForm'
import { MonarckMark } from '@/components/MonarckMark'
import { APP_NAME } from '@/lib/branding'
import { getCurrentSession, getRequestHost } from '@/lib/auth'
import {
  getTurnstileWidgetConfigForHostname,
  sanitizeReturnTo,
} from '@/lib/auth/turnstile'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const params = await searchParams
  const requestHeaders = await headers()
  const turnstileConfig = getTurnstileWidgetConfigForHostname(
    getRequestHost(requestHeaders),
  )
  const nextPath = sanitizeReturnTo(params.next)
  const authError = mapAuthError(params.error)
  const session = await getCurrentSession()

  if (session) {
    redirect(nextPath)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-10"
      style={{
        background:
          'radial-gradient(circle at top, rgba(239,68,68,0.12), transparent 28%), var(--bg)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
        }}
      >
        <section
          style={{
            borderRadius: '24px',
            padding: '32px 28px',
            background: 'var(--material-regular)',
            border: '1px solid var(--separator)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="flex flex-col items-center text-center"
            style={{ marginBottom: '20px', gap: '14px' }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '18px',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <MonarckMark size={34} />
            </div>
            <h1
              style={{
                fontSize: '28px',
                lineHeight: 1.05,
                margin: 0,
                color: 'var(--text-primary)',
                fontWeight: 700,
              }}
            >
              Sign in to {APP_NAME}
            </h1>
          </div>

          <p
            style={{
              fontSize: '14px',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            {authError
              ? authError
              : turnstileConfig?.siteKey
              ? 'Complete the security check to unlock Clerk sign-in.'
              : 'Continue with Clerk to sign in or create your first account.'}
          </p>

          <Show when="signed-out">
            <LoginForm
              nextPath={nextPath}
              turnstileSiteKey={turnstileConfig?.siteKey ?? null}
              initialError={authError}
            />
          </Show>

          <div
            style={{
              marginTop: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: 'var(--text-tertiary)',
              fontSize: '12px',
            }}
          >
            <Loader2 size={12} className="animate-spin" />
            <span>Powered by Clerk</span>
          </div>
        </section>
      </div>
    </div>
  )
}

function mapAuthError(error: string | undefined): string | null {
  if (!error) return null

  switch (error) {
    case 'Configuration':
      return 'Authentication is misconfigured for this dashboard.'
    case 'AccessDenied':
      return 'Access was denied by the identity provider.'
    case 'OAuthSignin':
    case 'OAuthCallback':
    case 'OAuthCreateAccount':
      return 'The identity provider could not complete sign-in.'
    case 'Callback':
      return 'The authentication callback was rejected.'
    default:
      return `Login failed: ${error}`
  }
}
