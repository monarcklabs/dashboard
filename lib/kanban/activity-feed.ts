import type { Agent, LiveLogLine } from '@/lib/types'
import type { KanbanStore } from './store'

export interface ActivityEntry {
  id: string
  agentId: string | null
  agentName: string
  agentColor: string
  summary: string
  timestamp: number
  source: 'log' | 'ticket'
}

interface ParsedLogContext {
  subsystem: string | null
  message: string
}

function prettifyIdentifier(value: string): string {
  return value
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function resolveAgentLabel(raw: string, agents: Agent[]): string {
  const normalized = raw.trim().toLowerCase()
  const found = agents.find(
    (agent) => agent.id.toLowerCase() === normalized || agent.name.toLowerCase() === normalized,
  )
  return found?.name || prettifyIdentifier(raw)
}

/**
 * Try to match a log message to a known agent.
 * Looks for patterns like "agent:vera:" or the agent name/id in the message.
 */
export function extractAgentFromLog(message: string, agents: Agent[]): Agent | null {
  if (!message || agents.length === 0) return null
  const lower = message.toLowerCase()

  // Pattern 1: "agent:<id>:" (common OpenClaw log format)
  const agentPattern = /agent:([^:]+):/i
  const match = message.match(agentPattern)
  if (match) {
    const id = match[1].toLowerCase()
    const found = agents.find((a) => a.id.toLowerCase() === id)
    if (found) return found
  }

  // Pattern 2: "[<name>]" or "[<id>]" bracket prefix
  const bracketPattern = /\[([^\]]+)\]/
  const bracketMatch = message.match(bracketPattern)
  if (bracketMatch) {
    const name = bracketMatch[1].toLowerCase()
    const found = agents.find(
      (a) => a.id.toLowerCase() === name || a.name.toLowerCase() === name,
    )
    if (found) return found
  }

  // Pattern 3: agent id appears as a word boundary in the message
  for (const agent of agents) {
    const id = agent.id.toLowerCase()
    // Require word boundary to avoid false matches on short ids
    if (id.length >= 3 && new RegExp(`\\b${escapeRegExp(id)}\\b`, 'i').test(lower)) {
      return agent
    }
  }

  return null
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Convert an ISO timestamp or unix ms into a human-readable relative time string.
 */
export function formatRelativeTime(timestamp: number | string): string {
  const ms = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp
  const diff = Date.now() - ms
  if (diff < 0) return 'just now'

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function parseLogContext(message: string): ParsedLogContext {
  const match = message.match(/^\{"subsystem":"([^"]+)"\}\s*(.*)$/)
  if (!match) {
    return { subsystem: null, message }
  }

  return {
    subsystem: match[1] || null,
    message: match[2] || '',
  }
}

function shouldIgnoreSubsystemNoise(line: LiveLogLine, subsystem: string | null, message: string): boolean {
  // Always surface errors
  if (line.level === 'error') return false

  // Keep warnings we explicitly translate into client-facing language.
  if (humanizeSystemLog(subsystem, message) !== message) return false

  // Filter out manifest/plugins noise (OpenAI-compatible provider, dashboard links)
  if (subsystem === 'plugins') return true
  if (/^\[plugins\]|\[manifest\]/.test(message)) return true

  // Filter out OTel/metrics noise
  if (/\bOtlpController\b|\bMetrics: \d+ points\b/i.test(message)) return true

  // Filter out gateway internals not relevant to clients
  if (/proxy headers detected|cron: armTimer skipped|pricing cache loaded|Refreshing OpenRouter pricing/i.test(message)) return true

  // Filter out debug-level logs
  if (line.level === 'debug') return true

  if (
    subsystem === 'gateway/channels/discord' ||
    subsystem === 'gateway/health-monitor'
  ) {
    if (
      /discord startup|deploy-rest:|fetch-bot-|logged in to discord as|message content intent|health-monitor: restarting/i.test(message)
    ) {
      return true
    }
  }

  return false
}

function humanizeSystemLog(subsystem: string | null, message: string): string {
  if (/proxy headers detected from untrusted address/i.test(message)) {
    return 'Gateway saw proxy headers from an untrusted address.'
  }

  if (/gateway timeout|timeout after \d+ms/i.test(message)) {
    return 'Gateway request timed out.'
  }

  if (/connection refused|econnrefused/i.test(message)) {
    return 'Gateway connection failed.'
  }

  if (subsystem === 'gateway/channels/discord' && /logged in to discord as/i.test(message)) {
    return 'Discord integration connected.'
  }

  if (subsystem === 'gateway/health-monitor' && /restarting/i.test(message)) {
    return 'Gateway health monitor restarted a service.'
  }

  return message
}

function humanizeAgentLog(message: string, agents: Agent[]): string | null {
  const trimmed = message.trim()

  const patterns: Array<[RegExp, (...groups: string[]) => string]> = [
    [
      /(?:delegating|delegated|handoff(?:ing)?|handed off)\s+(?:"([^"]+)"|ticket\s+"([^"]+)"|ticket\s+([^.]+?)|work)\s+(?:to|for)\s+(?:sub-?agent\s+)?([a-z0-9_-]+)/i,
      (quotedTitle, quotedTicket, plainTicket, rawAgent) => {
        const title = quotedTitle || quotedTicket || plainTicket
        const assignee = resolveAgentLabel(rawAgent, agents)
        return title
          ? `Delegated "${title.trim()}" to ${assignee}.`
          : `Delegated work to ${assignee}.`
      },
    ],
    [
      /(?:sub-?agent|agent)\s+([a-z0-9_-]+)\s+(?:started|is starting)\s+(?:work(?:ing)?\s+on\s+)?(?:"([^"]+)"|ticket\s+"([^"]+)"|ticket\s+([^.]+))?/i,
      (rawAgent, quotedTitle, quotedTicket, plainTicket) => {
        const agent = resolveAgentLabel(rawAgent, agents)
        const title = quotedTitle || quotedTicket || plainTicket
        return title
          ? `${agent} started "${title.trim()}".`
          : `${agent} started work.`
      },
    ],
    [
      /(?:sub-?agent|agent)\s+([a-z0-9_-]+)\s+(?:is working on|working on|processing|researching|reviewing|drafting)\s+(?:"([^"]+)"|ticket\s+"([^"]+)"|ticket\s+([^.]+))?/i,
      (rawAgent, quotedTitle, quotedTicket, plainTicket) => {
        const agent = resolveAgentLabel(rawAgent, agents)
        const title = quotedTitle || quotedTicket || plainTicket
        return title
          ? `${agent} is working on "${title.trim()}".`
          : `${agent} is actively working.`
      },
    ],
    [
      /(?:sub-?agent|agent)\s+([a-z0-9_-]+)\s+(?:completed|finished|wrapped up)\s+(?:"([^"]+)"|ticket\s+"([^"]+)"|ticket\s+([^.]+))?/i,
      (rawAgent, quotedTitle, quotedTicket, plainTicket) => {
        const agent = resolveAgentLabel(rawAgent, agents)
        const title = quotedTitle || quotedTicket || plainTicket
        return title
          ? `${agent} completed "${title.trim()}".`
          : `${agent} completed work.`
      },
    ],
    [
      /(?:sub-?agent|agent)\s+([a-z0-9_-]+)\s+(?:failed|hit an error|errored)\s+(?:while\s+working\s+on\s+)?(?:"([^"]+)"|ticket\s+"([^"]+)"|ticket\s+([^.]+))?/i,
      (rawAgent, quotedTitle, quotedTicket, plainTicket) => {
        const agent = resolveAgentLabel(rawAgent, agents)
        const title = quotedTitle || quotedTicket || plainTicket
        return title
          ? `${agent} hit an error on "${title.trim()}".`
          : `${agent} hit an error.`
      },
    ],
    [
      /(?:waiting|needs)\s+(?:for\s+)?(?:input|review|approval|clarification)(?:\s+on\s+(?:"([^"]+)"|ticket\s+"([^"]+)"|ticket\s+([^.]+)))?/i,
      (quotedTitle, quotedTicket, plainTicket) => {
        const title = quotedTitle || quotedTicket || plainTicket
        return title
          ? `Waiting on input for "${title.trim()}".`
          : 'Waiting on client input.'
      },
    ],
  ]

  for (const [pattern, formatter] of patterns) {
    const match = trimmed.match(pattern)
    if (match) return formatter(...match.slice(1))
  }

  return null
}

/**
 * Transform a raw LiveLogLine message into a short, human-readable summary.
 * Strips JSON noise, extracts the meaningful content.
 */
export function formatLogMessage(line: LiveLogLine): string {
  const context = parseLogContext(line.message)
  let msg = humanizeSystemLog(context.subsystem, context.message)

  // If the message looks like raw JSON, try to extract a summary field
  if (msg.startsWith('{')) {
    try {
      const parsed = JSON.parse(msg)
      msg =
        parsed.summary ||
        parsed.message ||
        parsed.msg ||
        parsed.description ||
        parsed.text ||
        msg
    } catch {
      // Not valid JSON, use as-is
    }
  }

  // Strip common prefixes like timestamps, log levels
  msg = msg.replace(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*Z?\s*/, '')
  msg = msg.replace(/^(INFO|WARN|ERROR|DEBUG|INF|WRN|ERR|DBG)\s*:?\s*/i, '')

  // Strip agent: prefix that we already extract separately
  msg = msg.replace(/^agent:[^:]+:\s*/, '')

  // Capitalize first letter
  if (msg.length > 0) {
    msg = msg.charAt(0).toUpperCase() + msg.slice(1)
  }

  return msg
}

/**
 * Convert a LiveLogLine into an ActivityEntry.
 */
export function logLineToEntry(line: LiveLogLine, agents: Agent[], index: number): ActivityEntry | null {
  const context = parseLogContext(line.message)
  if (shouldIgnoreSubsystemNoise(line, context.subsystem, context.message)) {
    return null
  }

  const agent = extractAgentFromLog(context.message, agents)
  const summary = humanizeAgentLog(context.message, agents) || formatLogMessage(line)
  return {
    id: `log-${line.time}-${index}`,
    agentId: agent?.id || null,
    agentName: agent?.name || 'System',
    agentColor: agent?.color || '#6b7280',
    summary,
    timestamp: new Date(line.time).getTime() || Date.now(),
    source: 'log',
  }
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'Review',
  done: 'Done',
}

/**
 * Compare two kanban store snapshots and produce activity entries for changes.
 */
export function diffTicketEvents(
  prev: KanbanStore,
  next: KanbanStore,
  agents: Agent[],
): ActivityEntry[] {
  const entries: ActivityEntry[] = []
  const now = Date.now()

  for (const [id, ticket] of Object.entries(next)) {
    const old = prev[id]

    // New ticket created
    if (!old) {
      const agent = ticket.assigneeId
        ? agents.find((a) => a.id === ticket.assigneeId) || null
        : null
      entries.push({
        id: `ticket-new-${id}-${now}`,
        agentId: agent?.id || null,
        agentName: agent?.name || 'System',
        agentColor: agent?.color || '#6b7280',
        summary: `New ticket: "${truncate(ticket.title, 50)}"`,
        timestamp: ticket.createdAt || now,
        source: 'ticket',
      })
      continue
    }

    // Status changed (moved columns)
    if (old.status !== ticket.status) {
      const agent = ticket.assigneeId
        ? agents.find((a) => a.id === ticket.assigneeId) || null
        : null
      entries.push({
        id: `ticket-move-${id}-${now}`,
        agentId: agent?.id || null,
        agentName: agent?.name || 'System',
        agentColor: agent?.color || '#6b7280',
        summary: `"${truncate(ticket.title, 40)}" moved to ${STATUS_LABELS[ticket.status] || ticket.status}`,
        timestamp: ticket.updatedAt || now,
        source: 'ticket',
      })
    }

    // Work state changed
    if (old.workState !== ticket.workState) {
      const agent = ticket.assigneeId
        ? agents.find((a) => a.id === ticket.assigneeId) || null
        : null

      let summary = ''
      switch (ticket.workState) {
        case 'starting':
          summary = `Starting work on "${truncate(ticket.title, 40)}"`
          break
        case 'working':
          summary = `Working on "${truncate(ticket.title, 40)}"`
          break
        case 'done':
          summary = `Completed work on "${truncate(ticket.title, 40)}"`
          break
        case 'failed':
          summary = `Work failed on "${truncate(ticket.title, 40)}"`
          break
        default:
          summary = ''
      }

      if (summary) {
        entries.push({
          id: `ticket-work-${id}-${ticket.workState}-${now}`,
          agentId: agent?.id || null,
          agentName: agent?.name || 'System',
          agentColor: agent?.color || '#6b7280',
          summary,
          timestamp: ticket.updatedAt || now,
          source: 'ticket',
        })
      }
    }
  }

  return entries
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '\u2026'
}
