// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { KanbanTicket } from './kanban/types'
import type { CronRun } from '@/lib/types'

const { mockGetKanbanStore, mockGetCronRuns } = vi.hoisted(() => ({
  mockGetKanbanStore: vi.fn(),
  mockGetCronRuns: vi.fn(),
}))

vi.mock('@/lib/kanban/server-store', () => ({
  getKanbanStore: mockGetKanbanStore,
}))

vi.mock('@/lib/cron-runs', () => ({
  getCronRuns: mockGetCronRuns,
}))

import { getDocEntries, getDocEntry } from './docs'

function makeTicket(overrides: Partial<KanbanTicket> = {}): KanbanTicket {
  return {
    id: 'ticket-1',
    title: 'Write quarterly report',
    description: 'A detailed report',
    useSessionMemory: false,
    relevantFiles: [],
    status: 'done',
    priority: 'medium',
    assigneeId: 'vera',
    assigneeRole: null,
    projectId: null,
    workState: 'done',
    workStartedAt: Date.now() - 60000,
    workError: null,
    workResult: '# Quarterly Report\n\nHere are the results...',
    createdAt: Date.now() - 120000,
    updatedAt: Date.now(),
    ...overrides,
  }
}

function makeCronRun(overrides: Partial<CronRun> = {}): CronRun {
  return {
    ts: Date.now(),
    jobId: 'abc123-morning-report-001',
    status: 'ok',
    summary: '# Morning Report\n\n' + 'This is a detailed report with enough content to pass the length threshold. '.repeat(3),
    error: null,
    durationMs: 5000,
    deliveryStatus: 'delivered',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    usage: { input_tokens: 1000, output_tokens: 500, total_tokens: 1500 },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetKanbanStore.mockReturnValue({})
  mockGetCronRuns.mockReturnValue([])
})

describe('getDocEntries', () => {
  it('returns empty array when no data', () => {
    expect(getDocEntries()).toEqual([])
  })

  it('includes completed kanban tickets with work results', () => {
    mockGetKanbanStore.mockReturnValue({
      'ticket-1': makeTicket(),
    })

    const docs = getDocEntries()
    expect(docs).toHaveLength(1)
    expect(docs[0].source).toBe('kanban')
    expect(docs[0].title).toBe('Write quarterly report')
    expect(docs[0].content).toContain('Quarterly Report')
    expect(docs[0].agentId).toBe('vera')
    expect(docs[0].id).toBe('kanban-ticket-1')
  })

  it('excludes tickets without work results', () => {
    mockGetKanbanStore.mockReturnValue({
      'ticket-1': makeTicket({ workResult: null }),
    })
    expect(getDocEntries()).toHaveLength(0)
  })

  it('excludes tickets still in progress', () => {
    mockGetKanbanStore.mockReturnValue({
      'ticket-1': makeTicket({ status: 'in-progress', workState: 'working' }),
    })
    expect(getDocEntries()).toHaveLength(0)
  })

  it('includes tickets in review status', () => {
    mockGetKanbanStore.mockReturnValue({
      'ticket-1': makeTicket({ status: 'review' }),
    })
    expect(getDocEntries()).toHaveLength(1)
  })

  it('includes cron runs with summaries', () => {
    mockGetCronRuns.mockReturnValue([makeCronRun()])

    const docs = getDocEntries()
    expect(docs).toHaveLength(1)
    expect(docs[0].source).toBe('cron')
    expect(docs[0].title).toBe('Morning Report')
    expect(docs[0].content).toContain('Morning Report')
    expect(docs[0].jobId).toBe('abc123-morning-report-001')
  })

  it('excludes cron runs without summaries', () => {
    mockGetCronRuns.mockReturnValue([makeCronRun({ summary: null })])
    expect(getDocEntries()).toHaveLength(0)
  })

  it('excludes cron runs with error status', () => {
    mockGetCronRuns.mockReturnValue([makeCronRun({ status: 'error' })])
    expect(getDocEntries()).toHaveLength(0)
  })

  it('excludes cron runs with very short summaries', () => {
    mockGetCronRuns.mockReturnValue([makeCronRun({ summary: 'Done.' })])
    expect(getDocEntries()).toHaveLength(0)
  })

  it('combines kanban and cron sources sorted by date', () => {
    const older = Date.now() - 86400000
    const newer = Date.now()

    mockGetKanbanStore.mockReturnValue({
      'ticket-1': makeTicket({ updatedAt: older }),
    })
    mockGetCronRuns.mockReturnValue([makeCronRun({ ts: newer })])

    const docs = getDocEntries()
    expect(docs).toHaveLength(2)
    expect(docs[0].source).toBe('cron')  // newer
    expect(docs[1].source).toBe('kanban') // older
  })

  it('handles kanban store errors gracefully', () => {
    mockGetKanbanStore.mockImplementation(() => { throw new Error('store error') })
    mockGetCronRuns.mockReturnValue([makeCronRun()])

    const docs = getDocEntries()
    expect(docs).toHaveLength(1)
    expect(docs[0].source).toBe('cron')
  })

  it('handles cron runs errors gracefully', () => {
    mockGetKanbanStore.mockReturnValue({ 'ticket-1': makeTicket() })
    mockGetCronRuns.mockImplementation(() => { throw new Error('cron error') })

    const docs = getDocEntries()
    expect(docs).toHaveLength(1)
    expect(docs[0].source).toBe('kanban')
  })
})

describe('getDocEntry', () => {
  it('returns a specific document by id', () => {
    mockGetKanbanStore.mockReturnValue({ 'ticket-1': makeTicket() })

    const doc = getDocEntry('kanban-ticket-1')
    expect(doc).not.toBeNull()
    expect(doc!.title).toBe('Write quarterly report')
  })

  it('returns null for unknown id', () => {
    expect(getDocEntry('nonexistent')).toBeNull()
  })
})
