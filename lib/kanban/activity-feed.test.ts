import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Agent, LiveLogLine } from '@/lib/types'
import type { KanbanStore } from './store'
import {
  extractAgentFromLog,
  formatRelativeTime,
  formatLogMessage,
  logLineToEntry,
  diffTicketEvents,
} from './activity-feed'

const baseAgent = {
  reportsTo: null,
  directReports: [],
  soulPath: null,
  soul: null,
  voiceId: null,
  tools: [],
  model: null,
  crons: [],
  memoryPath: null,
  description: '',
}

const agents: Agent[] = [
  { ...baseAgent, id: 'vera', name: 'VERA', title: 'Chief Strategy Officer', color: '#8b5cf6', emoji: '🔮' },
  { ...baseAgent, id: 'scout', name: 'Scout', title: 'Research Agent', reportsTo: 'vera', color: '#10b981', emoji: '🔍' },
  { ...baseAgent, id: 'henry', name: 'Henry', title: 'DevOps Agent', reportsTo: 'vera', color: '#3b82f6', emoji: '🔧' },
]

describe('extractAgentFromLog', () => {
  it('returns null for empty message', () => {
    expect(extractAgentFromLog('', agents)).toBeNull()
  })

  it('returns null for empty agents list', () => {
    expect(extractAgentFromLog('agent:vera:cron-run', [])).toBeNull()
  })

  it('matches agent:<id>: pattern', () => {
    expect(extractAgentFromLog('agent:vera:cron-run finished', agents)).toBe(agents[0])
    expect(extractAgentFromLog('agent:scout:daily-digest completed', agents)).toBe(agents[1])
  })

  it('matches [name] bracket pattern', () => {
    expect(extractAgentFromLog('[vera] completed task', agents)).toBe(agents[0])
    expect(extractAgentFromLog('[Scout] morning research done', agents)).toBe(agents[1])
  })

  it('matches agent id as word in message', () => {
    expect(extractAgentFromLog('Task assigned to vera for processing', agents)).toBe(agents[0])
    expect(extractAgentFromLog('henry started the deploy', agents)).toBe(agents[2])
  })

  it('does not match partial id strings', () => {
    // "ve" is too short (< 3 chars), wouldn't match as a pattern
    const shortAgents: Agent[] = [
      { ...agents[0], id: 've', name: 'Ve' },
    ]
    expect(extractAgentFromLog('I have verified the deploy', shortAgents)).toBeNull()
  })

  it('returns null when no agent matches', () => {
    expect(extractAgentFromLog('System started up', agents)).toBeNull()
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-03-22T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for recent timestamps', () => {
    expect(formatRelativeTime(Date.now())).toBe('just now')
    expect(formatRelativeTime(Date.now() - 30_000)).toBe('just now')
  })

  it('returns minutes for 1-59 min ago', () => {
    expect(formatRelativeTime(Date.now() - 2 * 60_000)).toBe('2m ago')
    expect(formatRelativeTime(Date.now() - 45 * 60_000)).toBe('45m ago')
  })

  it('returns hours for 1-23 hours ago', () => {
    expect(formatRelativeTime(Date.now() - 3 * 3600_000)).toBe('3h ago')
  })

  it('returns days for 24+ hours ago', () => {
    expect(formatRelativeTime(Date.now() - 48 * 3600_000)).toBe('2d ago')
  })

  it('accepts ISO string input', () => {
    expect(formatRelativeTime('2026-03-22T11:55:00Z')).toBe('5m ago')
  })

  it('returns "just now" for future timestamps', () => {
    expect(formatRelativeTime(Date.now() + 60_000)).toBe('just now')
  })
})

describe('formatLogMessage', () => {
  it('extracts summary from JSON message', () => {
    const result = formatLogMessage({
      type: 'log',
      time: '2026-03-22T12:00:00Z',
      level: 'info',
      message: '{"summary":"Completed daily research scan","status":"ok"}',
    })
    expect(result).toBe('Completed daily research scan')
  })

  it('strips agent: prefix', () => {
    const result = formatLogMessage({
      type: 'log',
      time: '2026-03-22T12:00:00Z',
      level: 'info',
      message: 'agent:vera: Finished cron job',
    })
    expect(result).toBe('Finished cron job')
  })

  it('strips log level prefixes', () => {
    const result = formatLogMessage({
      type: 'log',
      time: '2026-03-22T12:00:00Z',
      level: 'info',
      message: 'INFO: Server started successfully',
    })
    expect(result).toBe('Server started successfully')
  })

  it('capitalizes first letter', () => {
    const result = formatLogMessage({
      type: 'log',
      time: '2026-03-22T12:00:00Z',
      level: 'info',
      message: 'task completed',
    })
    expect(result).toBe('Task completed')
  })

  it('handles plain text messages', () => {
    const result = formatLogMessage({
      type: 'log',
      time: '2026-03-22T12:00:00Z',
      level: 'info',
      message: 'Health check passed',
    })
    expect(result).toBe('Health check passed')
  })
})

describe('logLineToEntry', () => {
  it('converts a log line with a known agent', () => {
    const line: LiveLogLine = {
      type: 'log',
      time: '2026-03-22T12:00:00Z',
      level: 'info',
      message: 'agent:scout: Completed morning research',
    }
    const entry = logLineToEntry(line, agents, 0)
    expect(entry.agentName).toBe('Scout')
    expect(entry.agentColor).toBe('#10b981')
    expect(entry.summary).toBe('Completed morning research')
    expect(entry.source).toBe('log')
  })

  it('falls back to System for unknown agents', () => {
    const line: LiveLogLine = {
      type: 'log',
      time: '2026-03-22T12:00:00Z',
      level: 'info',
      message: 'Gateway restarted',
    }
    const entry = logLineToEntry(line, agents, 0)
    expect(entry.agentName).toBe('System')
    expect(entry.agentColor).toBe('#6b7280')
  })
})

describe('diffTicketEvents', () => {
  const baseTicket = {
    id: 't1',
    title: 'Fix auth bug',
    description: '',
    status: 'backlog' as const,
    priority: 'medium' as const,
    assigneeId: 'scout',
    assigneeRole: null,
    projectId: null,
    workState: 'idle' as const,
    workStartedAt: null,
    workError: null,
    workResult: null,
    useSessionMemory: false,
    relevantFiles: [],
    createdAt: 1000,
    updatedAt: 1000,
  }

  it('detects new ticket creation', () => {
    const prev: KanbanStore = {}
    const next: KanbanStore = { t1: baseTicket }
    const events = diffTicketEvents(prev, next, agents)
    expect(events).toHaveLength(1)
    expect(events[0].summary).toContain('New ticket')
    expect(events[0].summary).toContain('Fix auth bug')
    expect(events[0].agentName).toBe('Scout')
  })

  it('detects status change', () => {
    const prev: KanbanStore = { t1: baseTicket }
    const next: KanbanStore = { t1: { ...baseTicket, status: 'in-progress', updatedAt: 2000 } }
    const events = diffTicketEvents(prev, next, agents)
    expect(events).toHaveLength(1)
    expect(events[0].summary).toContain('moved to In Progress')
  })

  it('detects work state starting', () => {
    const prev: KanbanStore = { t1: baseTicket }
    const next: KanbanStore = { t1: { ...baseTicket, workState: 'starting', updatedAt: 2000 } }
    const events = diffTicketEvents(prev, next, agents)
    const workEvent = events.find((e) => e.summary.includes('Starting work'))
    expect(workEvent).toBeDefined()
    expect(workEvent!.agentName).toBe('Scout')
  })

  it('detects work completion', () => {
    const prev: KanbanStore = { t1: { ...baseTicket, workState: 'working' } }
    const next: KanbanStore = { t1: { ...baseTicket, workState: 'done', updatedAt: 2000 } }
    const events = diffTicketEvents(prev, next, agents)
    const workEvent = events.find((e) => e.summary.includes('Completed work'))
    expect(workEvent).toBeDefined()
  })

  it('detects work failure', () => {
    const prev: KanbanStore = { t1: { ...baseTicket, workState: 'working' } }
    const next: KanbanStore = { t1: { ...baseTicket, workState: 'failed', updatedAt: 2000 } }
    const events = diffTicketEvents(prev, next, agents)
    const workEvent = events.find((e) => e.summary.includes('Work failed'))
    expect(workEvent).toBeDefined()
  })

  it('returns empty array when nothing changed', () => {
    const prev: KanbanStore = { t1: baseTicket }
    const next: KanbanStore = { t1: baseTicket }
    expect(diffTicketEvents(prev, next, agents)).toHaveLength(0)
  })

  it('uses System when no agent is assigned', () => {
    const unassigned = { ...baseTicket, assigneeId: null }
    const prev: KanbanStore = {}
    const next: KanbanStore = { t1: unassigned }
    const events = diffTicketEvents(prev, next, agents)
    expect(events[0].agentName).toBe('System')
  })
})
