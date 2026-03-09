// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
}))

vi.mock('child_process', () => ({
  execSync: mockExecSync,
  default: { execSync: mockExecSync },
}))

import { getKeychainToken, fetchClaudeCodeUsage } from './claude-usage'

const KEYCHAIN_JSON = (token: string) => JSON.stringify({
  claudeAiOauth: {
    accessToken: token,
    refreshToken: 'rt-123',
    expiresAt: Date.now() + 86400000,
    scopes: ['user:inference'],
  },
})

describe('getKeychainToken', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('extracts accessToken from keychain JSON', () => {
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('sk-ant-oat01-abc'))
    expect(getKeychainToken()).toBe('sk-ant-oat01-abc')
  })

  it('returns null when keychain lookup fails', () => {
    mockExecSync.mockImplementation(() => { throw new Error('security: SecKeychainSearchCopyNext') })
    expect(getKeychainToken()).toBeNull()
  })

  it('returns null for empty keychain value', () => {
    mockExecSync.mockReturnValue('')
    expect(getKeychainToken()).toBeNull()
  })

  it('returns null when JSON has no accessToken', () => {
    mockExecSync.mockReturnValue(JSON.stringify({ claudeAiOauth: {} }))
    expect(getKeychainToken()).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    mockExecSync.mockReturnValue('not-json')
    expect(getKeychainToken()).toBeNull()
  })
})

describe('fetchClaudeCodeUsage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = vi.fn()
  })

  it('returns null when keychain has no token', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    const result = await fetchClaudeCodeUsage()
    expect(result).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('parses API response correctly', async () => {
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('token-123'))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        five_hour: { utilization: 42.5, resets_at: '2026-03-09T15:00:00Z' },
        seven_day: { utilization: 18.2, resets_at: '2026-03-14T00:00:00Z' },
      }),
    })

    const result = await fetchClaudeCodeUsage()
    expect(result).toEqual({
      fiveHour: { utilization: 42.5, resetsAt: '2026-03-09T15:00:00Z' },
      sevenDay: { utilization: 18.2, resetsAt: '2026-03-14T00:00:00Z' },
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/api/oauth/usage',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer token-123',
          'anthropic-beta': 'oauth-2025-04-20',
        },
      }),
    )
  })

  it('returns null on non-200 response', async () => {
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('token-123'))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false })

    const result = await fetchClaudeCodeUsage()
    expect(result).toBeNull()
  })

  it('returns null on fetch error', async () => {
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('token-123'))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'))

    const result = await fetchClaudeCodeUsage()
    expect(result).toBeNull()
  })

  it('handles missing fields gracefully', async () => {
    mockExecSync.mockReturnValue(KEYCHAIN_JSON('token-123'))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    const result = await fetchClaudeCodeUsage()
    expect(result).toEqual({
      fiveHour: { utilization: 0, resetsAt: null },
      sevenDay: { utilization: 0, resetsAt: null },
    })
  })
})
