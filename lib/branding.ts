export const APP_NAME = 'Monarck'

export const CLIENT_HIDDEN_NAV_PATHS = ['/crons', '/memory', '/docs'] as const

export function isMonarckProductionHost(hostname: string): boolean {
  return hostname === 'monarck.ai' || hostname.endsWith('.monarck.ai')
}
