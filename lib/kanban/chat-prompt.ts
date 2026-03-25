import type { Agent, IntegrationItem } from '@/lib/types'
import type { ComposioConnection } from '@/lib/composio'

const MAX_TITLE = 500
const MAX_DESC = 5000
const MAX_RESULT = 10000

interface RawRelevantFile {
  id?: unknown
  name?: unknown
  mimeType?: unknown
  url?: unknown
}

interface RawTicketLike {
  title?: unknown
  description?: unknown
  useSessionMemory?: unknown
  relevantFiles?: unknown
  status?: unknown
  priority?: unknown
  assigneeRole?: unknown
  workResult?: unknown
}

export interface SanitizedRelevantFile {
  id: string
  name: string
  mimeType: string
  url: string
  /** Fetched file content, populated server-side before prompt building */
  content?: string
}

export interface SanitizedKanbanTicketContext {
  title: string
  description: string
  useSessionMemory: boolean
  relevantFiles: SanitizedRelevantFile[]
  status: string
  priority: string
  assigneeRole: string | null
  workResult: string | null
}

export function sanitizeKanbanTicketContext(rawTicket: unknown): SanitizedKanbanTicketContext | null {
  if (!rawTicket || typeof rawTicket !== 'object') return null

  const ticket = rawTicket as RawTicketLike
  const relevantFiles: SanitizedRelevantFile[] = Array.isArray(ticket.relevantFiles)
    ? (ticket.relevantFiles as RawRelevantFile[])
        .filter((f): f is RawRelevantFile & { name: string } => typeof f?.name === 'string')
        .slice(0, 20)
        .map((f) => ({
          id: typeof f.id === 'string' ? f.id : '',
          name: String(f.name),
          mimeType: typeof f.mimeType === 'string' ? f.mimeType : '',
          url: typeof f.url === 'string' ? f.url : '',
        }))
    : []

  return {
    title: String(ticket.title || '').slice(0, MAX_TITLE),
    description: String(ticket.description || '').slice(0, MAX_DESC),
    useSessionMemory: ticket.useSessionMemory === true,
    relevantFiles,
    status: String(ticket.status || ''),
    priority: String(ticket.priority || ''),
    assigneeRole: typeof ticket.assigneeRole === 'string' ? ticket.assigneeRole : null,
    workResult: typeof ticket.workResult === 'string' ? ticket.workResult.slice(0, MAX_RESULT) : null,
  }
}

export interface AgentEnvironmentContext {
  tools: string[]
  integrations: {
    channels: IntegrationItem[]
    tools: IntegrationItem[]
  }
  /** Live Composio connected services (e.g. ['gmail', 'google_sheets', 'slack']) */
  composioApps?: string[]
  composioConnections?: ComposioConnection[]
}

export function buildEnvironmentBlock(env: AgentEnvironmentContext | null): string {
  if (!env) return ''

  const parts: string[] = []

  if (env.tools.length > 0) {
    parts.push(`Your tools: ${env.tools.join(', ')}`)
  }

  const connectedTools = env.integrations.tools
    .filter(t => t.enabled !== false)
    .map(t => {
      const detail = t.summary.length > 0 ? ` (${t.summary.join(', ')})` : ''
      return `${t.id}${detail}`
    })
  const connectedChannels = env.integrations.channels
    .filter(c => c.enabled !== false)
    .map(c => {
      const detail = c.summary.length > 0 ? ` (${c.summary.join(', ')})` : ''
      return `${c.id}${detail}`
    })

  if (connectedTools.length > 0) {
    parts.push(`Connected integrations: ${connectedTools.join(', ')}`)
  }
  if (connectedChannels.length > 0) {
    parts.push(`Available channels: ${connectedChannels.join(', ')}`)
  }

  if (env.composioApps && env.composioApps.length > 0) {
    parts.push(`Composio connected services: ${env.composioApps.join(', ')}`)
  }

  const activeComposioConnections = (env.composioConnections || [])
    .filter((connection) => connection.status === 'active')
    .map((connection) => {
      const details = [
        `connected_account_id: ${connection.id}`,
        connection.authConfigId ? `auth_config_id: ${connection.authConfigId}` : null,
        connection.accountHint ? `account: ${connection.accountHint}` : null,
      ].filter(Boolean).join(', ')
      return `${connection.app}${details ? ` (${details})` : ''}`
    })

  if (activeComposioConnections.length > 0) {
    parts.push(`Composio connected accounts: ${activeComposioConnections.join('; ')}`)
  }

  if (parts.length === 0) return ''

  return `\n\nEnvironment:\n${parts.join('\n')}\nThese tools and integrations are already configured and available. Do not ask the user whether they are set up -- just use them.\nIf the user mentions a listed Composio connected account ID or auth config ID, treat it as an existing configured integration. Do not ask them to resend credentials or a session URL just to confirm it exists.`
}

export function buildKanbanSystemPrompt(
  agent: Pick<Agent, 'name' | 'title' | 'soul'>,
  ticket: SanitizedKanbanTicketContext | null,
  environment?: AgentEnvironmentContext | null,
  missionStatement?: string | null,
): string {
  const sessionMemoryRules = ticket?.useSessionMemory
    ? 'Session memory is enabled for this ticket. You may use relevant prior hidden session context if it helps continue the work, but restate enough context so the visible reply stands on its own.'
    : 'Treat each request as scoped only to the messages explicitly provided in this API call. Ignore any hidden or persistent session memory that is not present in those messages.\nIf the provided messages do not include a prior assistant reply, do not say "as I said above", "check my previous response", "already covered", or anything similar. Repeat the answer directly instead.'

  const ticketContext = ticket
    ? `You are working on ticket: "${ticket.title}".
Description: ${ticket.description || 'No description provided.'}
Status: ${ticket.status}
Priority: ${ticket.priority}
Your role: ${ticket.assigneeRole || 'unassigned'}${buildRelevantFilesBlock(ticket.relevantFiles)}${buildWorkContext(ticket.status, ticket.workResult)}
${buildMissionBlock(missionStatement)}

Help the user with this ticket. Stay in character as ${agent.name}, ${agent.title}. Be concise - 2-4 sentences unless detail is asked for. No em dashes.
${sessionMemoryRules}`
    : `You are ${agent.name}, ${agent.title}. Respond in character. Be concise. No em dashes.${buildMissionBlock(missionStatement)}
Treat each request as scoped only to the messages explicitly provided in this API call. Ignore any hidden or persistent session memory that is not present in those messages.
If the provided messages do not include a prior assistant reply, do not say "as I said above", "check my previous response", "already covered", or anything similar. Repeat the answer directly instead.`

  const envBlock = buildEnvironmentBlock(environment ?? null)

  return agent.soul
    ? `${agent.soul}\n\n${ticketContext}${envBlock}`
    : `${ticketContext}${envBlock}`
}

function buildMissionBlock(missionStatement: string | null | undefined): string {
  if (!missionStatement) return ''
  return `\nMission statement: ${missionStatement}\nUse it to align recommendations, priorities, and trade-offs.`
}

// ~5 k tokens shared across all attached files
const TOTAL_FILE_CHAR_BUDGET = 20000
const MAX_CSV_ROWS = 150

/** Normalizes whitespace and applies type-aware trimming before budgeting. */
function compactContent(text: string, mimeType: string): string {
  // Normalize line endings, trim trailing spaces per line, collapse excess blank lines
  let out = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // For CSV exports (Google Sheets), limit rows — each row can be very wide
  if (mimeType === 'text/csv') {
    const rows = out.split('\n')
    if (rows.length > MAX_CSV_ROWS) {
      out =
        rows.slice(0, MAX_CSV_ROWS).join('\n') +
        `\n[...${rows.length - MAX_CSV_ROWS} more rows omitted]`
    }
  }

  return out
}

function buildRelevantFilesBlock(files: SanitizedRelevantFile[]): string {
  if (files.length === 0) return ''

  // Compact all content first, then distribute the shared character budget proportionally
  const compacted = files.map((f) =>
    f.content ? compactContent(f.content, f.mimeType) : null
  )
  const filesWithContent = compacted.filter(Boolean).length
  const perFileBudget = filesWithContent > 0
    ? Math.floor(TOTAL_FILE_CHAR_BUDGET / filesWithContent)
    : TOTAL_FILE_CHAR_BUDGET

  const lines = files.map((f, i) => {
    const isDataUrl = f.url.startsWith('data:')
    const header = f.url && !isDataUrl ? `- "${f.name}" (${f.url})` : `- "${f.name}"`
    const content = compacted[i]
    if (!content) return header
    const body = content.length > perFileBudget
      ? content.slice(0, perFileBudget) + '\n[...truncated]'
      : content
    return `${header}\n\`\`\`\n${body}\n\`\`\``
  })

  return `\n\nRelevant files:\n${lines.join('\n')}\nReference these when relevant.`
}

function buildWorkContext(status: string, workResult: string | null): string {
  if (!workResult) return ''

  return `\n\n${buildWorkLeadIn(status)}\n${workResult}\n\nReference this work when answering follow-up questions. Build on it, don't repeat it unless asked.`
}

function buildWorkLeadIn(status: string): string {
  if (status === 'done' || status === 'review') {
    return 'You already completed work on this ticket. Here is what you produced:'
  }

  return 'You already made progress on this ticket. Here is the latest visible work:'
}
