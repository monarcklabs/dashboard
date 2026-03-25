export const runtime = 'nodejs'

import { getAgent } from '@/lib/agents'
import { validateChatMessages } from '@/lib/validation'
import { hasImageContent, extractImageAttachments, buildTextPrompt, sendViaOpenClaw } from '@/lib/anthropic'
import { getOpenAIClient } from '@/lib/openai'
import { buildEnvironmentBlock, type AgentEnvironmentContext } from '@/lib/kanban/chat-prompt'
import { getComposioConnections } from '@/lib/composio'
import { getGoogleWorkspaceConfig, getIntegrationsSummary } from '@/lib/integrations'
import type OpenAI from 'openai'

const ASYNC_FALLBACK_TIMEOUT_MS = 120_000
const MAX_MISSION_STATEMENT = 2000

function sanitizeMissionStatement(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, MAX_MISSION_STATEMENT) : null
}

function isGatewayTimeoutError(error: unknown): boolean {
  const raw = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : ''

  return /gateway timeout|timeout after \d+ms|timed out|etimedout/i.test(raw)
}

function buildFallbackSessionKey(agentId: string): string {
  const cleanAgentId = agentId.replace(/[^a-z0-9_-]/gi, '-').slice(0, 40) || 'agent'
  const rand = Math.random().toString(36).slice(2, 8)
  return `chat:${cleanAgentId}:${Date.now().toString(36)}:${rand}`
}

function createSseResponseFromText(content: string): Response {
  const encoder = new TextEncoder()
  const streamBody = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(streamBody, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function gatewayToken(): string {
  return process.env.OPENCLAW_GATEWAY_TOKEN || ''
}

function humanizeChatError(error: unknown): string {
  const raw = typeof error === 'string'
    ? error.trim()
    : error instanceof Error
      ? error.message.trim()
      : ''

  if (!raw) {
    return 'Error getting response.'
  }

  if (/aborterror|aborted|timed out/i.test(raw)) {
    return 'Agent response timed out.'
  }

  if (/gateway|econnrefused|fetch failed|network|socket hang up/i.test(raw)) {
    return 'Chat failed. Make sure OpenClaw gateway is running.'
  }

  return raw
}

async function tryAsyncGatewayFallback(
  agentId: string,
  systemPrompt: string,
  messages: OpenAI.ChatCompletionMessageParam[],
  signal: AbortSignal,
): Promise<string | null> {
  const textMessages = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: typeof message.content === 'string' ? message.content : '',
    }))

  return sendViaOpenClaw({
    gatewayToken: gatewayToken(),
    message: buildTextPrompt(systemPrompt, textMessages),
    attachments: [],
    sessionKey: buildFallbackSessionKey(agentId),
    timeoutMs: ASYNC_FALLBACK_TIMEOUT_MS,
    signal,
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const openai = getOpenAIClient()
  const { id } = await params
  const agent = await getAgent(id)

  if (!agent) {
    return new Response(JSON.stringify({ error: 'Agent not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const result = validateChatMessages(body)
  if (!result.ok) {
    return new Response(
      JSON.stringify({ error: result.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { messages } = result

  const rawBody = body as Record<string, unknown>
  const operatorName = typeof rawBody.operatorName === 'string' ? rawBody.operatorName : 'Operator'
  const missionStatement = sanitizeMissionStatement(rawBody.missionStatement)
  const gwsConfig = getGoogleWorkspaceConfig()

  let environment: AgentEnvironmentContext | null = null
  try {
    const [summary, composioConnections] = await Promise.all([
      Promise.resolve(getIntegrationsSummary()),
      getComposioConnections(),
    ])
    const composioApps = [...new Set(
      composioConnections
        .filter((connection) => connection.status === 'active')
        .map((connection) => connection.app)
    )]
    const allServices = [...composioApps]
    if (gwsConfig?.driveEnabled) {
      if (!allServices.includes('googledrive')) allServices.push('googledrive')
      if (!allServices.includes('googledocs')) allServices.push('googledocs')
    }
    environment = {
      tools: Array.isArray(agent.tools) ? agent.tools : [],
      integrations: {
        channels: summary.channels,
        tools: summary.tools,
      },
      composioApps: allServices,
      composioConnections,
    }
  } catch {
    // Non-fatal. Proceed without environment context.
  }

  const systemPrompt = agent.soul
    ? `${agent.soul}\n\nYou are speaking directly with ${operatorName}, your operator. Stay fully in character. Be concise — this is a live chat. 2-4 sentences unless detail is asked for. No em dashes.${missionStatement ? `\n\nMission statement:\n${missionStatement}\nUse it to keep recommendations and decisions aligned with the user's goals.` : ''}${buildEnvironmentBlock(environment)}`
    : `You are ${agent.name}, ${agent.title}. Respond in character. Be concise. No em dashes.${missionStatement ? `\n\nMission statement:\n${missionStatement}\nUse it to keep recommendations and decisions aligned with the user's goals.` : ''}${buildEnvironmentBlock(environment)}`

  const completionMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ] as OpenAI.ChatCompletionMessageParam[]

  // When the LATEST user message contains images, use the OpenClaw gateway's
  // chat.send pipeline. Only check the last message — older messages with images
  // should not force all future messages through this path.
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const latestHasImages = lastUserMsg ? hasImageContent([lastUserMsg]) : false

  if (latestHasImages && gatewayToken()) {
    const attachments = extractImageAttachments([lastUserMsg!])
    const textPrompt = buildTextPrompt(systemPrompt, messages)

    const response = await sendViaOpenClaw({
      gatewayToken: gatewayToken(),
      message: textPrompt,
      attachments,
      signal: request.signal,
    })

    // Return as a non-streaming SSE response (complete text at once)
    const encoder = new TextEncoder()
    const content = response || 'I had trouble processing that image. Could you try again or describe what you see?'
    const streamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(streamBody, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  try {
    const stream = await openai.chat.completions.create({
      model: agent.model || 'claude-sonnet-4-6',
      stream: true,
      messages: completionMessages,
    })

    const streamBody = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let streamedAnyContent = false
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              streamedAnyContent = true
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              )
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          if (!streamedAnyContent && isGatewayTimeoutError(err)) {
            const fallbackContent = await tryAsyncGatewayFallback(id, systemPrompt, completionMessages, request.signal)
            if (fallbackContent?.trim()) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: fallbackContent })}\n\n`)
              )
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              return
            }
          }

          console.error('Stream error:', err)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: humanizeChatError(err) })}\n\n`)
          )
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(streamBody, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err: unknown) {
    if (isGatewayTimeoutError(err)) {
      const fallbackContent = await tryAsyncGatewayFallback(id, systemPrompt, completionMessages, request.signal)
      if (fallbackContent?.trim()) {
        return createSseResponseFromText(fallbackContent)
      }
    }

    console.error('Chat API error:', err)

    let userMessage = 'Chat failed. Make sure OpenClaw gateway is running.'
    if (err instanceof Error && 'status' in err && (err as { status: number }).status === 405) {
      userMessage = 'Gateway returned 405. Enable the HTTP endpoint: set gateway.http.endpoints.chatCompletions.enabled = true in ~/.openclaw/openclaw.json, then restart the gateway.'
    } else if (!(err instanceof Error && 'status' in err)) {
      userMessage = humanizeChatError(err)
    }

    return new Response(
      JSON.stringify({ error: userMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
