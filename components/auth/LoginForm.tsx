'use client'

import { FormEvent, useState } from 'react'
import { Loader2, LogIn, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'

export function LoginForm({
  nextPath,
  turnstileSiteKey,
}: {
  nextPath: string
  turnstileSiteKey: string | null
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0)

  const turnstileEnabled = Boolean(turnstileSiteKey)
  const canSubmit = !pending && (!turnstileEnabled || Boolean(turnstileToken))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (turnstileEnabled && !turnstileToken) {
      setError('Complete the Turnstile check before continuing.')
      return
    }

    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextPath, turnstileToken }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Login failed.')
        if (turnstileEnabled) {
          setTurnstileResetSignal((value) => value + 1)
        }
        return
      }

      const redirectTo =
        typeof data?.redirectTo === 'string' && data.redirectTo.startsWith('/')
          ? data.redirectTo
          : '/api/auth/signin/authentik'

      window.location.assign(redirectTo)
    } catch {
      setError('Could not reach the login endpoint.')
      if (turnstileEnabled) {
        setTurnstileResetSignal((value) => value + 1)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div
        style={{
          borderRadius: '16px',
          border: '1px solid var(--separator)',
          background: 'var(--material-ultra-thin)',
          padding: '14px 16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <ShieldCheck size={18} style={{ color: 'var(--system-green)', marginTop: '2px' }} />
        <div>
          <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>
            Authentik manages credentials
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginTop: '4px' }}>
            Password changes, resets, and account policy now live in authentik instead of this app.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            borderRadius: '12px',
            border: '1px solid rgba(255,69,58,0.3)',
            background: 'rgba(255,69,58,0.08)',
            color: 'var(--system-red)',
            padding: '10px 12px',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {turnstileEnabled && turnstileSiteKey && (
        <div
          style={{
            borderRadius: '16px',
            border: '1px solid var(--separator)',
            background: 'var(--material-ultra-thin)',
            padding: '12px',
          }}
        >
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            resetSignal={turnstileResetSignal}
            onTokenChange={setTurnstileToken}
          />
        </div>
      )}

      <Button type="submit" size="lg" disabled={!canSubmit} className="w-full">
        {pending ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
        {pending ? 'Redirecting...' : 'Continue to login'}
      </Button>
    </form>
  )
}
