// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createCompletion: vi.fn(),
  getAgent: vi.fn(),
  getIntegrationsSummary: vi.fn(),
  getGoogleWorkspaceConfig: vi.fn(),
  getComposioConnections: vi.fn(),
  sendViaOpenClaw: vi.fn(),
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
  getComposioConnections: mocks.getComposioConnections,
}))

vi.mock('@/lib/anthropic', async () => {
  const actual = await vi.importActual<typeof import('@/lib/anthropic')>('@/lib/anthropic')
  return {
    ...actual,
    sendViaOpenClaw: mocks.sendViaOpenClaw,
  }
})

import { POST } from './route'

function makeRequest() {
  return new Request('http://localhost/api/chat/ecommerce-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Can you use the Shopify integration to determine the best selling product?' },
      ],
      operatorName: 'Pinchy',
      missionStatement: 'Help the business make data-driven ecommerce decisions.',
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

describe('POST /api/chat/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('OPENCLAW_GATEWAY_TOKEN', 'test-token')

    mocks.getAgent.mockResolvedValue({
      id: 'ecommerce-lead',
      name: 'Ecommerce Lead',
      title: 'Ecommerce Lead',
      soul: 'Focus on ecommerce analytics.',
      model: 'claude-sonnet-4-6',
      tools: [],
    })
    mocks.getIntegrationsSummary.mockReturnValue({ channels: [], tools: [] })
    mocks.getGoogleWorkspaceConfig.mockReturnValue(null)
    mocks.getComposioConnections.mockResolvedValue([
      {
        id: 'con_shopify_123',
        app: 'shopify',
        status: 'active',
        authConfigId: 'ac_8V2E7xvePlWX',
        userId: null,
        accountHint: 'pinchy-store.myshopify.com',
      },
    ])
    mocks.sendViaOpenClaw.mockResolvedValue('Top seller appears to be the black hoodie.')
  })

  it('falls back to async gateway when the initial completion request times out', async () => {
    mocks.createCompletion.mockRejectedValue(new Error('Gateway call failed: Error: gateway timeout after 10000ms'))

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'ecommerce-lead' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/event-stream')
    await expect(readResponseText(response)).resolves.toContain('Top seller appears to be the black hoodie.')
    expect(mocks.sendViaOpenClaw).toHaveBeenCalledOnce()
    expect(mocks.sendViaOpenClaw.mock.calls[0][0]).toMatchObject({
      gatewayToken: 'test-token',
      attachments: [],
      timeoutMs: 120000,
    })
    expect(mocks.sendViaOpenClaw.mock.calls[0][0].message).toContain('Shopify integration')
    expect(mocks.sendViaOpenClaw.mock.calls[0][0].message).toContain('auth_config_id: ac_8V2E7xvePlWX')
    expect(mocks.sendViaOpenClaw.mock.calls[0][0].message).toContain('pinchy-store.myshopify.com')
    expect(mocks.sendViaOpenClaw.mock.calls[0][0].sessionKey).toMatch(/^chat:ecommerce-lead:/)
  })

  it('still attempts async fallback when the gateway token is not configured', async () => {
    vi.unstubAllEnvs()
    mocks.createCompletion.mockRejectedValue(new Error('Gateway call failed: Error: gateway timeout after 10000ms'))

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'ecommerce-lead' }),
    })

    expect(response.status).toBe(200)
    await expect(readResponseText(response)).resolves.toContain('Top seller appears to be the black hoodie.')
    expect(mocks.sendViaOpenClaw).toHaveBeenCalledOnce()
    expect(mocks.sendViaOpenClaw.mock.calls[0][0].gatewayToken).toBe('')
  })

  it('sends an SSE error event instead of ending with an empty reply when the stream fails', async () => {
    const failingStream = {
      async *[Symbol.asyncIterator]() {
        throw new Error('socket hang up')
      },
    }
    mocks.createCompletion.mockResolvedValue(failingStream)

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'ecommerce-lead' }),
    })

    expect(response.status).toBe(200)
    await expect(readResponseText(response)).resolves.toContain('"error":"Chat failed. Make sure OpenClaw gateway is running."')
    expect(mocks.sendViaOpenClaw).not.toHaveBeenCalled()
  })
})
