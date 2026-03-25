import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadTickets,
  loadTicketSnapshot,
  saveTickets,
  saveTicketSnapshot,
  createTicket,
  updateTicket,
  moveTicket,
  deleteTicket,
  deleteTicketInSnapshot,
  getTicketsByStatus,
  mergeTicketSnapshots,
  reconcileRemoteSnapshot,
  sanitizeSnapshot,
  type KanbanSnapshot,
  type KanbanStore,
} from './store'

// Mock localStorage
const storage: Record<string, string> = {}
beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, val: string) => { storage[key] = val },
    removeItem: (key: string) => { delete storage[key] },
  })
})

// Mock crypto.randomUUID
beforeEach(() => {
  let counter = 0
  vi.stubGlobal('crypto', {
    randomUUID: () => `test-uuid-${++counter}`,
  })
})

// Default work state fields for test tickets
const WORK_DEFAULTS = { workState: 'idle' as const, workStartedAt: null, workError: null, workResult: null, relevantFiles: [] as import('./types').RelevantFile[], projectId: null }

describe('loadTickets', () => {
  it('returns empty object when nothing stored', () => {
    expect(loadTickets()).toEqual({})
  })

  it('returns parsed data from localStorage', () => {
    const data = { 'id-1': { id: 'id-1', title: 'Test' } }
    storage['clawport-kanban'] = JSON.stringify(data)
    const loaded = loadTickets()
    expect(loaded['id-1'].id).toBe('id-1')
    expect(loaded['id-1'].title).toBe('Test')
    // Backfilled work state fields
    expect(loaded['id-1'].workState).toBe('idle')
    expect(loaded['id-1'].workStartedAt).toBeNull()
    expect(loaded['id-1'].workError).toBeNull()
    expect(loaded['id-1'].useSessionMemory).toBe(false)
  })

  it('returns empty object on invalid JSON', () => {
    storage['clawport-kanban'] = 'not-json'
    expect(loadTickets()).toEqual({})
  })

  it('returns tickets from snapshot format', () => {
    storage['clawport-kanban'] = JSON.stringify({
      tickets: { 'id-1': { id: 'id-1', title: 'Test' } },
      deleted: { old: 1234 },
    })
    expect(loadTickets()['id-1']?.title).toBe('Test')
  })
})

describe('loadTicketSnapshot', () => {
  it('returns empty snapshot when nothing stored', () => {
    expect(loadTicketSnapshot()).toEqual({ tickets: {}, deleted: {} })
  })

  it('keeps deletion tombstones and removes matching stale tickets', () => {
    storage['clawport-kanban'] = JSON.stringify({
      tickets: { 'id-1': { id: 'id-1', title: 'Test', updatedAt: 1000 } },
      deleted: { 'id-1': 2000 },
    })

    expect(loadTicketSnapshot()).toEqual({
      tickets: {},
      deleted: { 'id-1': 2000 },
    })
  })
})

describe('saveTickets', () => {
  it('persists to localStorage', () => {
    const store: KanbanStore = {}
    saveTickets(store)
    expect(storage['clawport-kanban']).toBe('{}')
  })
})

describe('saveTicketSnapshot', () => {
  it('persists snapshot format', () => {
    const snapshot: KanbanSnapshot = { tickets: {}, deleted: { t1: 1234 } }
    saveTicketSnapshot(snapshot)
    expect(storage['clawport-kanban']).toBe(JSON.stringify(snapshot))
  })
})

describe('createTicket', () => {
  it('adds a ticket with generated id and timestamps', () => {
    const store: KanbanStore = {}
    const result = createTicket(store, {
      title: 'New ticket',
      description: 'Do the thing',
      useSessionMemory: true,
      relevantFiles: [],
      status: 'backlog',
      priority: 'medium',
      assigneeId: null,
      assigneeRole: null,
      projectId: null,
    })

    const ticket = result['test-uuid-1']
    expect(ticket).toBeDefined()
    expect(ticket.title).toBe('New ticket')
    expect(ticket.status).toBe('backlog')
    expect(ticket.useSessionMemory).toBe(true)
    expect(ticket.id).toBe('test-uuid-1')
    expect(ticket.createdAt).toBeTypeOf('number')
    expect(ticket.updatedAt).toBe(ticket.createdAt)
  })

  it('preserves existing tickets', () => {
    const store: KanbanStore = {
      existing: {
        id: 'existing',
        title: 'Existing',
        description: '',
        useSessionMemory: false,
        status: 'todo',
        priority: 'low',
        assigneeId: null,
        assigneeRole: null,
        ...WORK_DEFAULTS,
        createdAt: 1000,
        updatedAt: 1000,
      },
    }
    const result = createTicket(store, {
      title: 'New',
      description: '',
      useSessionMemory: false,
      relevantFiles: [],
      status: 'backlog',
      priority: 'medium',
      assigneeId: null,
      assigneeRole: null,
      projectId: null,
    })
    expect(result['existing']).toBeDefined()
    expect(Object.keys(result)).toHaveLength(2)
  })
})

describe('updateTicket', () => {
  const baseStore: KanbanStore = {
    't1': {
      id: 't1',
      title: 'Original',
      description: 'Desc',
      useSessionMemory: false,
      status: 'backlog',
      priority: 'low',
      assigneeId: null,
      assigneeRole: null,
      ...WORK_DEFAULTS,
      createdAt: 1000,
      updatedAt: 1000,
    },
  }

  it('updates specified fields', () => {
    const result = updateTicket(baseStore, 't1', { title: 'Updated' })
    expect(result['t1'].title).toBe('Updated')
    expect(result['t1'].description).toBe('Desc')
    expect(result['t1'].updatedAt).toBeGreaterThan(1000)
  })

  it('returns store unchanged for missing ticket', () => {
    const result = updateTicket(baseStore, 'missing', { title: 'X' })
    expect(result).toBe(baseStore)
  })
})

describe('moveTicket', () => {
  it('changes ticket status', () => {
    const store: KanbanStore = {
      't1': {
        id: 't1',
        title: 'Task',
        description: '',
        useSessionMemory: false,
        status: 'backlog',
        priority: 'medium',
        assigneeId: null,
        assigneeRole: null,
        ...WORK_DEFAULTS,
        createdAt: 1000,
        updatedAt: 1000,
      },
    }
    const result = moveTicket(store, 't1', 'in-progress')
    expect(result['t1'].status).toBe('in-progress')
  })
})

describe('deleteTicket', () => {
  it('removes the ticket', () => {
    const store: KanbanStore = {
      't1': {
        id: 't1',
        title: 'Task',
        description: '',
        useSessionMemory: false,
        status: 'backlog',
        priority: 'medium',
        assigneeId: null,
        assigneeRole: null,
        ...WORK_DEFAULTS,
        createdAt: 1000,
        updatedAt: 1000,
      },
    }
    const result = deleteTicket(store, 't1')
    expect(result['t1']).toBeUndefined()
  })

  it('preserves other tickets', () => {
    const store: KanbanStore = {
      't1': {
        id: 't1', title: 'A', description: '', status: 'backlog',
        useSessionMemory: false, priority: 'low', assigneeId: null, assigneeRole: null,
        ...WORK_DEFAULTS, createdAt: 1000, updatedAt: 1000,
      },
      't2': {
        id: 't2', title: 'B', description: '', status: 'todo',
        useSessionMemory: false, priority: 'high', assigneeId: null, assigneeRole: null,
        ...WORK_DEFAULTS, createdAt: 2000, updatedAt: 2000,
      },
    }
    const result = deleteTicket(store, 't1')
    expect(result['t2']).toBeDefined()
    expect(Object.keys(result)).toHaveLength(1)
  })
})

describe('deleteTicketInSnapshot', () => {
  it('removes the ticket and records a tombstone', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(5000)
    const snapshot: KanbanSnapshot = {
      tickets: {
        't1': {
          id: 't1',
          title: 'Task',
          description: '',
          useSessionMemory: false,
          status: 'backlog',
          priority: 'medium',
          assigneeId: null,
          assigneeRole: null,
          ...WORK_DEFAULTS,
          createdAt: 1000,
          updatedAt: 1000,
        },
      },
      deleted: {},
    }

    const result = deleteTicketInSnapshot(snapshot, 't1')
    expect(result.tickets['t1']).toBeUndefined()
    expect(result.deleted['t1']).toBe(5000)
    nowSpy.mockRestore()
  })
})

describe('sanitizeSnapshot', () => {
  it('supports legacy bare-store format', () => {
    expect(sanitizeSnapshot({ 't1': { id: 't1', title: 'Task' } })).toEqual({
      tickets: expect.objectContaining({
        t1: expect.objectContaining({ title: 'Task' }),
      }),
      deleted: {},
    })
  })

  it('preserves active work state during hydration', () => {
    const snapshot = sanitizeSnapshot({
      tickets: {
        t1: {
          id: 't1',
          title: 'Task',
          description: '',
          useSessionMemory: false,
          relevantFiles: [],
          status: 'in-progress',
          priority: 'medium',
          assigneeId: 'agent-1',
          assigneeRole: null,
          projectId: null,
          workState: 'working',
          workStartedAt: 2000,
          workError: null,
          workResult: null,
          createdAt: 1000,
          updatedAt: 2000,
        },
      },
      deleted: {},
    })

    expect(snapshot.tickets.t1).toMatchObject({
      status: 'in-progress',
      workState: 'working',
      workStartedAt: 2000,
    })
  })
})

describe('mergeTicketSnapshots', () => {
  it('keeps a deleted ticket deleted when merging with stale copies', () => {
    const merged = mergeTicketSnapshots(
      {
        tickets: {},
        deleted: { t1: 3000 },
      },
      {
        tickets: {
          t1: {
            id: 't1',
            title: 'Stale',
            description: '',
            useSessionMemory: false,
            status: 'todo',
            priority: 'medium',
            assigneeId: null,
            assigneeRole: null,
            ...WORK_DEFAULTS,
            createdAt: 1000,
            updatedAt: 2000,
          },
        },
        deleted: {},
      },
    )

    expect(merged.tickets.t1).toBeUndefined()
    expect(merged.deleted.t1).toBe(3000)
  })

  it('allows a newer ticket update to beat an older deletion', () => {
    const merged = mergeTicketSnapshots(
      {
        tickets: {},
        deleted: { t1: 2000 },
      },
      {
        tickets: {
          t1: {
            id: 't1',
            title: 'Restored',
            description: '',
            useSessionMemory: false,
            status: 'todo',
            priority: 'medium',
            assigneeId: null,
            assigneeRole: null,
            ...WORK_DEFAULTS,
            createdAt: 1000,
            updatedAt: 3000,
          },
        },
        deleted: {},
      },
    )

    expect(merged.tickets.t1?.title).toBe('Restored')
  })
})

describe('reconcileRemoteSnapshot', () => {
  it('prefers remote tickets while preserving local deletion tombstones', () => {
    const reconciled = reconcileRemoteSnapshot(
      {
        tickets: {},
        deleted: {},
      },
      {
        tickets: {
          stale: {
            id: 'stale',
            title: 'Stale local ticket',
            description: '',
            useSessionMemory: false,
            status: 'todo',
            priority: 'medium',
            assigneeId: null,
            assigneeRole: null,
            ...WORK_DEFAULTS,
            createdAt: 1000,
            updatedAt: 2000,
          },
        },
        deleted: { removed: 3000 },
      },
    )

    expect(reconciled).toEqual({
      tickets: {},
      deleted: { removed: 3000 },
    })
  })
})

describe('getTicketsByStatus', () => {
  const store: KanbanStore = {
    't1': {
      id: 't1', title: 'Old', description: '', status: 'backlog',
      useSessionMemory: false, priority: 'low', assigneeId: null, assigneeRole: null,
      ...WORK_DEFAULTS, createdAt: 1000, updatedAt: 1000,
    },
    't2': {
      id: 't2', title: 'New', description: '', status: 'backlog',
      useSessionMemory: false, priority: 'medium', assigneeId: null, assigneeRole: null,
      ...WORK_DEFAULTS, createdAt: 2000, updatedAt: 3000,
    },
    't3': {
      id: 't3', title: 'Other', description: '', status: 'todo',
      useSessionMemory: false, priority: 'high', assigneeId: null, assigneeRole: null,
      ...WORK_DEFAULTS, createdAt: 1500, updatedAt: 1500,
    },
  }

  it('filters by status', () => {
    const backlog = getTicketsByStatus(store, 'backlog')
    expect(backlog).toHaveLength(2)
    expect(backlog.every((t) => t.status === 'backlog')).toBe(true)
  })

  it('sorts by updatedAt descending', () => {
    const backlog = getTicketsByStatus(store, 'backlog')
    expect(backlog[0].id).toBe('t2')
    expect(backlog[1].id).toBe('t1')
  })

  it('returns empty array for empty column', () => {
    expect(getTicketsByStatus(store, 'done')).toEqual([])
  })
})
