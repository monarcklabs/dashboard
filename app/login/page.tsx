import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { ShieldCheck } from 'lucide-react'
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
  searchParams: Promise<{ next?: string }>
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
  const session = await getCurrentSession()

  if (session) {
    redirect(nextPath)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-10"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(239,68,68,0.2), transparent 32%), radial-gradient(circle at bottom right, rgba(10,132,255,0.15), transparent 28%), var(--bg)',
      }}
    >
      <div
        className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
        style={{
          width: '100%',
          maxWidth: '1040px',
          alignItems: 'stretch',
        }}
      >
        <section
          style={{
            borderRadius: '28px',
            padding: '32px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
            border: '1px solid var(--separator)',
            boxShadow: 'var(--shadow-overlay)',
          }}
        >
          <div className="flex items-center gap-4" style={{ marginBottom: '24px' }}>
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
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                }}
              >
                Protected workspace
              </div>
              <h1
                style={{
                  fontSize: '32px',
                  lineHeight: 1.05,
                  margin: '4px 0 0',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                }}
              >
                Sign in to {APP_NAME}
              </h1>
            </div>
          </div>

          <p
            style={{
              fontSize: '16px',
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              maxWidth: '52ch',
              marginBottom: '28px',
            }}
          >
            This deployment now uses authentik for identity and app-level session enforcement for
            every page and API request. Customer accounts stay isolated per VM, and password
            management lives in the identity provider instead of local environment config.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['OIDC with authentik', 'This deployment trusts only its local authentik tenant.'],
              ['Per-client isolation', 'Each VM keeps its own identity boundary and OpenClaw instance.'],
              ['Protected APIs', 'Dashboard pages and route handlers share the same session gate.'],
            ].map(([title, body]) => (
              <div
                key={title}
                style={{
                  borderRadius: '18px',
                  border: '1px solid var(--separator)',
                  background: 'var(--material-ultra-thin)',
                  padding: '18px',
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '8px',
                  }}
                >
                  {title}
                </div>
                <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            borderRadius: '28px',
            padding: '32px',
            background: 'var(--material-regular)',
            border: '1px solid var(--separator)',
            boxShadow: 'var(--shadow-card)',
            alignSelf: 'center',
          }}
        >
          <div style={{ marginBottom: '22px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
              }}
            >
              Identity
            </div>
            <h2
              style={{
                fontSize: '24px',
                lineHeight: 1.1,
                color: 'var(--text-primary)',
                fontWeight: 650,
                marginTop: '8px',
              }}
            >
              Continue with authentik
            </h2>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '14px',
                lineHeight: 1.6,
                marginTop: '10px',
              }}
            >
              You will be redirected to this deployment&apos;s authentik login. After authentication,
              you will be returned to the dashboard page you originally requested.
            </p>
          </div>

          <LoginForm
            nextPath={nextPath}
            turnstileSiteKey={turnstileConfig?.siteKey ?? null}
          />
        </section>
      </div>
    </div>
  )
}
