'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
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
  const startedRef = useRef(false)

  const turnstileEnabled = Boolean(turnstileSiteKey)

  const startLogin = useCallback(async (token: string | null) => {
    if (startedRef.current) return
    if (turnstileEnabled && !token) return
    startedRef.current = true
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextPath, turnstileToken: token }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Login failed.')
        if (turnstileEnabled) {
          setTurnstileResetSignal((value) => value + 1)
        }
        startedRef.current = false
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
      startedRef.current = false
    } finally {
      setPending(false)
    }
  }, [nextPath, turnstileEnabled])

  useEffect(() => {
    if (!turnstileEnabled) {
      void startLogin(null)
    }
  }, [startLogin, turnstileEnabled])

  useEffect(() => {
    if (turnstileEnabled && turnstileToken) {
      void startLogin(turnstileToken)
    }
  }, [startLogin, turnstileEnabled, turnstileToken])

  return (
    <div className="flex flex-col gap-4">
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
            onTokenChange={(token) => {
              setError(null)
              setTurnstileToken(token)
            }}
          />
        </div>
      )}

      <div
        style={{
          minHeight: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          color: 'var(--text-secondary)',
          fontSize: '13px',
        }}
      >
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Redirecting to login...</span>
          </>
        ) : turnstileEnabled ? (
          <span>Complete the check to continue.</span>
        ) : (
          <span>Preparing login...</span>
        )}
      </div>
    </div>
  )
}
