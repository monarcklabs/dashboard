import { execSync } from 'child_process'
import type { ClaudeCodeUsage } from '@/lib/types'

const ANTHROPIC_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'

/**
 * Read the Claude Code OAuth token from the macOS Keychain.
 * Credential is stored as JSON under "Claude Code-credentials" service.
 * Returns the bare access token, or null if not found.
 */
export function getKeychainToken(): string | null {
  try {
    const raw = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w',
      { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim()
    if (!raw) return null

    const parsed = JSON.parse(raw)
    const token = parsed?.claudeAiOauth?.accessToken
    return typeof token === 'string' && token.length > 0 ? token : null
  } catch {
    return null
  }
}

/**
 * Fetch Claude Code subscription usage (five-hour window + seven-day cap).
 * Returns null if the Keychain token is unavailable or the API call fails.
 */
export async function fetchClaudeCodeUsage(): Promise<ClaudeCodeUsage | null> {
  const token = getKeychainToken()
  if (!token) return null

  try {
    const res = await fetch(ANTHROPIC_USAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null

    const data = await res.json()

    // API returns { five_hour: { utilization, resets_at }, seven_day: { ... } }
    return {
      fiveHour: {
        utilization: data.five_hour?.utilization ?? 0,
        resetsAt: data.five_hour?.resets_at ?? null,
      },
      sevenDay: {
        utilization: data.seven_day?.utilization ?? 0,
        resetsAt: data.seven_day?.resets_at ?? null,
      },
    }
  } catch {
    return null
  }
}
