'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Script from 'next/script'

export function TurnstileWidget({
  siteKey,
  resetSignal,
  onTokenChange,
}: {
  siteKey: string
  resetSignal: number
  onTokenChange: (token: string | null) => void
}) {
  const containerId = useId()
  const widgetIdRef = useRef<string | null>(null)
  const renderedRef = useRef(false)
  const [apiReady, setApiReady] = useState(
    typeof window !== 'undefined' && Boolean(window.turnstile),
  )

  useEffect(() => {
    if (window.turnstile) {
      setApiReady(true)
    }
  }, [])

  useEffect(() => {
    function renderWidget() {
      if (!apiReady || renderedRef.current || !window.turnstile) return

      const container = document.getElementById(containerId)
      if (!container) return

      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: siteKey,
        theme: 'dark',
        size: 'flexible',
        action: 'login',
        callback: (token) => onTokenChange(token),
        'expired-callback': () => onTokenChange(null),
        'timeout-callback': () => onTokenChange(null),
        'error-callback': () => onTokenChange(null),
      })
      renderedRef.current = true
    }

    renderWidget()
  }, [apiReady, containerId, onTokenChange, siteKey])

  useEffect(() => {
    if (!widgetIdRef.current || !window.turnstile) return
    window.turnstile.reset(widgetIdRef.current)
    onTokenChange(null)
  }, [onTokenChange, resetSignal])

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setApiReady(true)}
      />
      <div
        id={containerId}
        style={{
          minHeight: '66px',
          borderRadius: '14px',
        }}
      />
    </>
  )
}
