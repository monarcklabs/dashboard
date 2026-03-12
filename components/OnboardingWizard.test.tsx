import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup } from '@testing-library/react'
import { OnboardingWizard } from './OnboardingWizard'
import { APP_NAME } from '@/lib/branding'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock conversations module -- controls what fetchOnboarded returns
const mockFetchOnboarded = vi.fn<() => Promise<boolean>>()
const mockSyncOnboarded = vi.fn()
vi.mock('@/lib/conversations', () => ({
  fetchOnboarded: () => mockFetchOnboarded(),
  syncOnboarded: (v: boolean) => mockSyncOnboarded(v),
}))

// Mock settings provider
vi.mock('@/app/settings-provider', () => ({
  useSettings: () => ({
    settings: {
      accentColor: null,
      portalName: null,
      portalSubtitle: null,
      portalEmoji: null,
      portalIcon: null,
      iconBgHidden: false,
      emojiOnly: false,
      operatorName: null,
      agentOverrides: {},
      liveStreamPosition: null,
    },
    setAccentColor: vi.fn(),
    setPortalName: vi.fn(),
    setPortalSubtitle: vi.fn(),
    setOperatorName: vi.fn(),
    setPortalEmoji: vi.fn(),
    setPortalIcon: vi.fn(),
    setIconBgHidden: vi.fn(),
    setEmojiOnly: vi.fn(),
    setAgentOverride: vi.fn(),
  }),
}))

// Mock theme provider
vi.mock('@/app/providers', () => ({
  useTheme: () => ({
    theme: 'dark' as const,
    setTheme: vi.fn(),
  }),
}))

// Mock themes module
vi.mock('@/lib/themes', () => ({
  THEMES: [{ id: 'dark', label: 'Dark', emoji: '🌙' }],
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWizard(props: { forceOpen?: boolean; onClose?: () => void } = {}) {
  return render(<OnboardingWizard {...props} />)
}

// ---------------------------------------------------------------------------
// Tests: First-run detection (the onboarding trigger bug fix)
// ---------------------------------------------------------------------------

describe('OnboardingWizard first-run detection', () => {
  const welcomeText = `Welcome to ${APP_NAME}`

  beforeEach(() => {
    localStorage.clear()
    mockFetchOnboarded.mockReset()
    mockSyncOnboarded.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows wizard when no localStorage flag and server says not onboarded', async () => {
    mockFetchOnboarded.mockResolvedValue(false)

    const { container } = renderWizard()

    await waitFor(() => {
      expect(container.textContent).toContain(welcomeText)
    })
    expect(localStorage.getItem('clawport-onboarded')).toBeNull()
  })

  it('hides wizard and sets localStorage when no flag but server says onboarded', async () => {
    mockFetchOnboarded.mockResolvedValue(true)

    const { container } = renderWizard()

    await waitFor(() => {
      expect(localStorage.getItem('clawport-onboarded')).toBe('1')
    })
    // Wizard should NOT be visible (returns null)
    expect(container.textContent).not.toContain(welcomeText)
  })

  it('hides wizard when localStorage flag set and server confirms onboarded', async () => {
    localStorage.setItem('clawport-onboarded', '1')
    mockFetchOnboarded.mockResolvedValue(true)

    const { container } = renderWizard()

    await waitFor(() => {
      expect(mockFetchOnboarded).toHaveBeenCalled()
    })
    expect(container.textContent).not.toContain(welcomeText)
    expect(localStorage.getItem('clawport-onboarded')).toBe('1')
  })

  // THE KEY BUG FIX TEST: workspace moved, server says not onboarded,
  // but localStorage still has the stale flag
  it('shows wizard when localStorage flag is set but server says NOT onboarded (workspace moved)', async () => {
    localStorage.setItem('clawport-onboarded', '1')
    mockFetchOnboarded.mockResolvedValue(false)

    const { container } = renderWizard()

    await waitFor(() => {
      expect(container.textContent).toContain(welcomeText)
    })
    // Stale localStorage flag should be cleared
    expect(localStorage.getItem('clawport-onboarded')).toBeNull()
  })

  it('trusts localStorage when server is unreachable (existing user, gateway down)', async () => {
    localStorage.setItem('clawport-onboarded', '1')
    mockFetchOnboarded.mockRejectedValue(new Error('Network error'))

    const { container } = renderWizard()

    await waitFor(() => {
      expect(mockFetchOnboarded).toHaveBeenCalled()
    })
    // Should NOT show wizard -- trust the localStorage flag
    expect(container.textContent).not.toContain(welcomeText)
    expect(localStorage.getItem('clawport-onboarded')).toBe('1')
  })

  it('shows wizard when no localStorage flag and server is unreachable (fresh install)', async () => {
    mockFetchOnboarded.mockRejectedValue(new Error('Network error'))

    const { container } = renderWizard()

    await waitFor(() => {
      expect(container.textContent).toContain(welcomeText)
    })
  })

  it('always shows wizard when forceOpen is true regardless of flags', async () => {
    localStorage.setItem('clawport-onboarded', '1')
    // fetchOnboarded should NOT even be called with forceOpen
    mockFetchOnboarded.mockResolvedValue(true)

    const { container } = renderWizard({ forceOpen: true })

    await waitFor(() => {
      expect(container.textContent).toContain(welcomeText)
    })
    // forceOpen skips the server check entirely
    expect(mockFetchOnboarded).not.toHaveBeenCalled()
  })
})
