'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { SignInButton, SignUpButton } from '@clerk/nextjs'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'

export function LoginForm({
  nextPath,
  turnstileSiteKey,
  initialError,
}: {
  nextPath: string
  turnstileSiteKey: string | null
  initialError?: string | null
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [verified, setVerified] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0)
  const startedRef = useRef(false)

  const turnstileEnabled = Boolean(turnstileSiteKey)
  const hasBlockingError = Boolean(initialError)

  const verifyLogin = useCallback(async (token: string | null) => {
    if (startedRef.current || hasBlockingError) return
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

      setVerified(true)
      return
    } catch {
      setError('Could not reach the login endpoint.')
      if (turnstileEnabled) {
        setTurnstileResetSignal((value) => value + 1)
      }
      startedRef.current = false
    } finally {
      setPending(false)
    }
  }, [hasBlockingError, nextPath, turnstileEnabled])

  useEffect(() => {
    if (!turnstileEnabled && !hasBlockingError) {
      void verifyLogin(null)
    }
  }, [hasBlockingError, turnstileEnabled, verifyLogin])

  useEffect(() => {
    if (turnstileEnabled && turnstileToken && !hasBlockingError) {
      void verifyLogin(turnstileToken)
    }
  }, [hasBlockingError, turnstileEnabled, turnstileToken, verifyLogin])

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

      {verified && !error && (
        <div className="flex flex-col gap-3">
          <SignInButton mode="modal" forceRedirectUrl={nextPath}>
            <button
              type="button"
              style={{
                width: '100%',
                minHeight: '44px',
                borderRadius: '14px',
                border: '1px solid rgba(239,68,68,0.2)',
                background: 'rgba(239,68,68,0.12)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Continue with Clerk
            </button>
          </SignInButton>

          <SignUpButton mode="modal" forceRedirectUrl={nextPath}>
            <button
              type="button"
              style={{
                width: '100%',
                minHeight: '44px',
                borderRadius: '14px',
                border: '1px solid var(--separator)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Create your account
            </button>
          </SignUpButton>
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
            <span>Preparing secure sign-in...</span>
          </>
        ) : hasBlockingError ? (
          <span>Resolve the login error and try again.</span>
        ) : verified ? (
          <span>Continue with Clerk to finish signing in.</span>
        ) : turnstileEnabled ? (
          <span>Complete the check to continue.</span>
        ) : (
          <span>Preparing secure sign-in...</span>
        )}
      </div>
    </div>
  )
}
