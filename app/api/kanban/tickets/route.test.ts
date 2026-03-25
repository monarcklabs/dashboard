// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getKanbanSnapshot: vi.fn(),
  saveKanbanSnapshot: vi.fn(),
}))

vi.mock('@/lib/kanban/server-store', () => ({
  getKanbanSnapshot: mocks.getKanbanSnapshot,
  saveKanbanSnapshot: mocks.saveKanbanSnapshot,
}))

import { GET, PUT } from './route'

describe('kanban tickets route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the current snapshot on GET', async () => {
    mocks.getKanbanSnapshot.mockReturnValue({
      tickets: {},
      deleted: {},
    })

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      tickets: {},
      deleted: {},
    })
  })

  it('merges incoming snapshots with the server snapshot before saving', async () => {
    mocks.getKanbanSnapshot.mockReturnValue({
      tickets: {},
      deleted: { t1: 3000 },
    })

    const response = await PUT(new Request('http://localhost/api/kanban/tickets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tickets: {
          t1: {
            id: 't1',
            title: 'Stale copy',
            description: '',
            useSessionMemory: false,
            relevantFiles: [],
            status: 'todo',
            priority: 'medium',
            assigneeId: null,
            assigneeRole: null,
            projectId: null,
            workState: 'idle',
            workStartedAt: null,
            workError: null,
            workResult: null,
            createdAt: 1000,
            updatedAt: 2000,
          },
        },
        deleted: {},
      }),
    }))

    expect(response.status).toBe(200)
    expect(mocks.saveKanbanSnapshot).toHaveBeenCalledWith({
      tickets: {},
      deleted: { t1: 3000 },
    })
    await expect(response.json()).resolves.toEqual({
      ok: true,
      tickets: {},
      deleted: { t1: 3000 },
    })
  })
})
