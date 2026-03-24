// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createCompletion: vi.fn(),
  getAgent: vi.fn(),
  getIntegrationsSummary: vi.fn(),
  getGoogleWorkspaceConfig: vi.fn(),
  getActiveComposioApps: vi.fn(),
  sendViaOpenClaw: vi.fn(),
  downloadDriveFile: vi.fn(),
}))

vi.mock('openai', () => {
  return {
    default: class OpenAI {
      chat = {
        completions: {
          create: mocks.createCompletion,
        },
      }
    },
  }
})

vi.mock('@/lib/agents', () => ({
  getAgent: mocks.getAgent,
}))

vi.mock('@/lib/integrations', () => ({
  getIntegrationsSummary: mocks.getIntegrationsSummary,
  getGoogleWorkspaceConfig: mocks.getGoogleWorkspaceConfig,
}))

vi.mock('@/lib/composio', () => ({
  getActiveComposioApps: mocks.getActiveComposioApps,
}))

vi.mock('@/lib/anthropic', async () => {
  const actual = await vi.importActual<typeof import('@/lib/anthropic')>('@/lib/anthropic')
  return {
    ...actual,
    sendViaOpenClaw: mocks.sendViaOpenClaw,
  }
})

vi.mock('@/lib/google-drive', () => ({
  downloadDriveFile: mocks.downloadDriveFile,
}))

import { POST } from './route'

function makeRequest(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  return new Request('http://localhost/api/kanban/chat/legal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      ticket: {
        title: 'Investigate timeout',
        description: 'Follow up on prior work.',
        useSessionMemory: false,
        relevantFiles: [],
        status: 'review',
        priority: 'high',
        assigneeRole: 'lead-dev',
        workResult: 'Existing implementation summary.',
      },
    }),
  })
}

async function readResponseText(response: Response): Promise<string> {
  const body = response.body
  if (!body) return ''
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let out = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value, { stream: true })
  }

  out += decoder.decode()
  return out
}

describe('POST /api/kanban/chat/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('OPENCLAW_GATEWAY_TOKEN', 'test-token')

    mocks.getAgent.mockResolvedValue({
      id: 'legal',
      name: 'Legal Lead',
      title: 'Legal',
      soul: 'Stay precise.',
      model: 'claude-sonnet-4-6',
      tools: [],
    })
    mocks.getIntegrationsSummary.mockReturnValue({ channels: [], tools: [] })
    mocks.getGoogleWorkspaceConfig.mockReturnValue(null)
    mocks.getActiveComposioApps.mockResolvedValue([])
    mocks.downloadDriveFile.mockResolvedValue(null)
    mocks.sendViaOpenClaw.mockResolvedValue('Recovered through async fallback.')
  })

  it('falls back to async gateway when the initial completion request times out', async () => {
    mocks.createCompletion.mockRejectedValue(new Error('Gateway call failed: Error: gateway timeout after 10000ms'))

    const response = await POST(makeRequest([{ role: 'user', content: 'Please continue.' }]), {
      params: Promise.resolve({ id: 'legal' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/event-stream')
    await expect(readResponseText(response)).resolves.toContain('Recovered through async fallback.')
    expect(mocks.sendViaOpenClaw).toHaveBeenCalledOnce()
    expect(mocks.sendViaOpenClaw.mock.calls[0][0]).toMatchObject({
      gatewayToken: 'test-token',
      attachments: [],
      timeoutMs: 120000,
    })
    expect(mocks.sendViaOpenClaw.mock.calls[0][0].message).toContain('Please continue.')
    expect(mocks.sendViaOpenClaw.mock.calls[0][0].sessionKey).toMatch(/^kanban:legal:/)
  })

  it('still attempts async fallback when the gateway token is not configured', async () => {
    vi.unstubAllEnvs()
    mocks.createCompletion.mockRejectedValue(new Error('Gateway call failed: Error: gateway timeout after 10000ms'))

    const response = await POST(makeRequest([{ role: 'user', content: 'Please continue.' }]), {
      params: Promise.resolve({ id: 'legal' }),
    })

    expect(response.status).toBe(200)
    await expect(readResponseText(response)).resolves.toContain('Recovered through async fallback.')
    expect(mocks.sendViaOpenClaw).toHaveBeenCalledOnce()
    expect(mocks.sendViaOpenClaw.mock.calls[0][0].gatewayToken).toBe('')
  })

  it('falls back when the stream errors before any content is emitted', async () => {
    const failingStream = {
      async *[Symbol.asyncIterator]() {
        throw new Error('gateway timeout after 10000ms')
      },
    }
    mocks.createCompletion.mockResolvedValue(failingStream)

    const response = await POST(makeRequest([{ role: 'user', content: 'Reply to the latest update.' }]), {
      params: Promise.resolve({ id: 'legal' }),
    })

    expect(response.status).toBe(200)
    await expect(readResponseText(response)).resolves.toContain('Recovered through async fallback.')
    expect(mocks.sendViaOpenClaw).toHaveBeenCalledOnce()
  })
})
