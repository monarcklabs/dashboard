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
  if (!subsystem) return false

  if (
    subsystem === 'gateway/channels/discord' ||
    subsystem === 'gateway/health-monitor'
  ) {
    if (line.level === 'error') return false

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
  return {
    id: `log-${line.time}-${index}`,
    agentId: agent?.id || null,
    agentName: agent?.name || 'System',
    agentColor: agent?.color || '#6b7280',
    summary: formatLogMessage(line),
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
