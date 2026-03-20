interface TurnstileRenderOptions {
  sitekey: string
  action?: string
  theme?: 'auto' | 'light' | 'dark'
  size?: 'normal' | 'compact' | 'flexible'
  callback?: (token: string) => void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
  'error-callback'?: () => void
}

interface TurnstileApi {
  render: (container: Element | string, options: TurnstileRenderOptions) => string
  reset: (widgetId?: string) => void
}

interface Window {
  turnstile?: TurnstileApi
}
