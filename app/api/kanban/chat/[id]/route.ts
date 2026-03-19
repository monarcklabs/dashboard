export const runtime = 'nodejs'

import { getAgent } from '@/lib/agents'
import OpenAI from 'openai'
import { gatewayBaseUrl } from '@/lib/env'
import { buildKanbanSystemPrompt, sanitizeKanbanTicketContext, type AgentEnvironmentContext } from '@/lib/kanban/chat-prompt'
import { getIntegrationsSummary, getGoogleWorkspaceConfig } from '@/lib/integrations'
import { getActiveComposioApps } from '@/lib/composio'
import { humanizeKanbanChatError } from '@/lib/kanban/chat-errors'
import { downloadDriveFile } from '@/lib/google-drive'

const openai = new OpenAI({
  baseURL: gatewayBaseUrl(),
  apiKey: process.env.OPENCLAW_GATEWAY_TOKEN,
})

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml', 'application/javascript']

function extractTextFromDataUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,([^]*)$/)
  if (!match) return null
  const [, mimeType, isBase64, data] = match
  const isText = TEXT_MIME_PREFIXES.some((p) => mimeType.startsWith(p))
  if (!isText) return null
  return isBase64
    ? Buffer.from(data, 'base64').toString('utf-8')
    : decodeURIComponent(data)
}

function isValidMessage(m: unknown): m is { role: 'user' | 'assistant'; content: string } {
  if (!m || typeof m !== 'object') return false
  const msg = m as Record<string, unknown>
  return (
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string' &&
    msg.content.length > 0
  )
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const agent = await getAgent(id)

  if (!agent) {
    return new Response(JSON.stringify({ error: 'Agent not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { messages?: unknown; ticket?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const rawMessages = body.messages
  if (!Array.isArray(rawMessages) || !rawMessages.every(isValidMessage)) {
    return new Response(
      JSON.stringify({ error: 'messages must be an array of {role, content} objects' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
  const messages = rawMessages as { role: 'user' | 'assistant'; content: string }[]

  const ticket = sanitizeKanbanTicketContext(body.ticket)

  const gwsConfig = getGoogleWorkspaceConfig()

  // Fetch file content server-side so the agent can read the actual documents
  if (ticket && ticket.relevantFiles.length > 0) {
    await Promise.all(
      ticket.relevantFiles.map(async (file) => {
        try {
          if (file.url.startsWith('data:')) {
            // Uploaded file — decode base64 data URL to text
            file.content = extractTextFromDataUrl(file.url) ?? undefined
          } else if (file.id && gwsConfig) {
            // Google Drive file — download via service account
            const text = await downloadDriveFile(file.id, file.mimeType, gwsConfig)
            if (text) file.content = text
          }
        } catch {
          // Non-fatal — agent gets name/URL only for this file
        }
      })
    )
  }

  let environment: AgentEnvironmentContext | null = null
  try {
    const [summary, composioApps] = await Promise.all([
      Promise.resolve(getIntegrationsSummary()),
      getActiveComposioApps(),
    ])
    // Merge Composio apps with GWS service account integrations
    const allServices = [...composioApps]
    if (gwsConfig?.driveEnabled) {
      if (!allServices.includes('googledrive')) allServices.push('googledrive')
      if (!allServices.includes('googledocs')) allServices.push('googledocs')
    }
    environment = {
      tools: agent.tools,
      integrations: {
        channels: summary.channels,
        tools: summary.tools,
      },
      composioApps: allServices,
    }
  } catch {
    // Non-fatal — proceed without environment context
  }

  const systemPrompt = buildKanbanSystemPrompt(agent, ticket, environment)

  try {
    const stream = await openai.chat.completions.create({
      model: agent.model || 'claude-sonnet-4-6',
      stream: true,
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ] as OpenAI.ChatCompletionMessageParam[],
    })

    const streamBody = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              )
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          const errMsg = humanizeKanbanChatError(err)
          console.error(`Kanban chat stream error [agentId=${id}]:`, err instanceof Error ? err.message : err)
          // Signal error to client before closing
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
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
  } catch (err) {
    const errMsg = humanizeKanbanChatError(err)
    console.error(`Kanban chat API error [agentId=${id}]:`, err instanceof Error ? err.message : err)
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
