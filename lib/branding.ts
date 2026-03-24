export const APP_NAME = 'Monarck'
export const CLIENT_HUB_PATH = '/dashboard'

export const CLIENT_HIDDEN_NAV_PATHS = ['/crons', '/memory', '/docs'] as const
const CLIENT_FACING_HOSTS = new Set(['monarck.ai', 'app.monarck.ai'])

export function isMonarckProductionHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '')
  return CLIENT_FACING_HOSTS.has(normalized)
}

export function shouldShowClientHub(isClientFacingHost: boolean | null): boolean {
  return isClientFacingHost === true
}

export function shouldHideClientNavPath(
  path: string,
  isClientFacingHost: boolean | null,
): boolean {
  if (isClientFacingHost !== true) return false
  return CLIENT_HIDDEN_NAV_PATHS.includes(
    path as typeof CLIENT_HIDDEN_NAV_PATHS[number],
  )
}
