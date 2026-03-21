import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Loader2, ShieldCheck } from 'lucide-react'
import { LoginForm } from '@/components/auth/LoginForm'
import { MonarckMark } from '@/components/MonarckMark'
import { APP_NAME } from '@/lib/branding'
import { authIsConfigured, getCurrentSession, getRequestHost } from '@/lib/auth'
import {
  getTurnstileWidgetConfigForHostname,
  sanitizeReturnTo,
} from '@/lib/auth/turnstile'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  if (!authIsConfigured()) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: 'var(--bg)' }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '520px',
            borderRadius: '24px',
            border: '1px solid rgba(255,69,58,0.25)',
            background: 'linear-gradient(180deg, rgba(255,69,58,0.12), rgba(255,69,58,0.04))',
            boxShadow: 'var(--shadow-overlay)',
            padding: '28px',
            color: 'var(--text-primary)',
          }}
        >
          <div className="flex items-center gap-3" style={{ marginBottom: '14px' }}>
            <ShieldCheck size={20} style={{ color: 'var(--system-red)' }} />
            <strong>Auth configuration error</strong>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Authentik is not configured. Set AUTHENTIK_ISSUER, AUTHENTIK_CLIENT_ID,
            AUTHENTIK_CLIENT_SECRET, and NEXTAUTH_SECRET.
          </p>
        </div>
      </div>
    )
  }

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
              ? 'Complete the security check and you will be redirected to sign in.'
              : 'Redirecting to sign in.'}
          </p>

          <LoginForm
            nextPath={nextPath}
            turnstileSiteKey={turnstileConfig?.siteKey ?? null}
            initialError={authError}
          />

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
            <span>Powered by authentik</span>
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
