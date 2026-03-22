import { describe, it, expect } from 'vitest'
import {
  sanitizeProjectStore,
  mergeProjectStores,
  createProject,
  updateProject,
  deleteProject,
  type ProjectStore,
} from './projects-store'

describe('sanitizeProjectStore', () => {
  it('returns empty for invalid input', () => {
    expect(sanitizeProjectStore(null)).toEqual({})
    expect(sanitizeProjectStore(undefined)).toEqual({})
    expect(sanitizeProjectStore([])).toEqual({})
    expect(sanitizeProjectStore('bad')).toEqual({})
  })

  it('sanitizes valid projects', () => {
    const store = sanitizeProjectStore({
      p1: { name: 'Test', description: 'Desc', status: 'active', priority: 'high', agentId: 'vera', createdAt: 1000, updatedAt: 2000 },
    })
    expect(store.p1).toBeDefined()
    expect(store.p1.name).toBe('Test')
    expect(store.p1.status).toBe('active')
    expect(store.p1.priority).toBe('high')
    expect(store.p1.agentId).toBe('vera')
  })

  it('rejects projects without a name', () => {
    const store = sanitizeProjectStore({
      p1: { description: 'No name' },
    })
    expect(Object.keys(store)).toHaveLength(0)
  })

  it('defaults status to planning and priority to medium', () => {
    const store = sanitizeProjectStore({
      p1: { name: 'Test' },
    })
    expect(store.p1.status).toBe('planning')
    expect(store.p1.priority).toBe('medium')
    expect(store.p1.agentId).toBeNull()
    expect(store.p1.description).toBe('')
  })

  it('rejects invalid status values', () => {
    const store = sanitizeProjectStore({
      p1: { name: 'Test', status: 'invalid' },
    })
    expect(store.p1.status).toBe('planning')
  })
})

describe('mergeProjectStores', () => {
  it('merges by updatedAt', () => {
    const base: ProjectStore = {
      p1: { id: 'p1', name: 'Old', description: '', status: 'planning', priority: 'medium', agentId: null, createdAt: 1000, updatedAt: 1000 },
    }
    const incoming: ProjectStore = {
      p1: { id: 'p1', name: 'New', description: '', status: 'active', priority: 'high', agentId: null, createdAt: 1000, updatedAt: 2000 },
    }
    const merged = mergeProjectStores(base, incoming)
    expect(merged.p1.name).toBe('New')
    expect(merged.p1.status).toBe('active')
  })

  it('keeps base when incoming is older', () => {
    const base: ProjectStore = {
      p1: { id: 'p1', name: 'Newer', description: '', status: 'active', priority: 'medium', agentId: null, createdAt: 1000, updatedAt: 3000 },
    }
    const incoming: ProjectStore = {
      p1: { id: 'p1', name: 'Older', description: '', status: 'planning', priority: 'medium', agentId: null, createdAt: 1000, updatedAt: 1000 },
    }
    const merged = mergeProjectStores(base, incoming)
    expect(merged.p1.name).toBe('Newer')
  })

  it('adds new projects from incoming', () => {
    const base: ProjectStore = {}
    const incoming: ProjectStore = {
      p1: { id: 'p1', name: 'New', description: '', status: 'planning', priority: 'medium', agentId: null, createdAt: 1000, updatedAt: 1000 },
    }
    const merged = mergeProjectStores(base, incoming)
    expect(merged.p1).toBeDefined()
  })
})

describe('CRUD operations', () => {
  it('creates a project with generated id and timestamps', () => {
    const store = createProject({}, { name: 'Test', description: 'Desc', status: 'active', priority: 'high', agentId: 'vera' })
    const projects = Object.values(store)
    expect(projects).toHaveLength(1)
    expect(projects[0].name).toBe('Test')
    expect(projects[0].id).toBeTruthy()
    expect(projects[0].createdAt).toBeGreaterThan(0)
  })

  it('updates a project', () => {
    const store: ProjectStore = {
      p1: { id: 'p1', name: 'Old', description: '', status: 'planning', priority: 'medium', agentId: null, createdAt: 1000, updatedAt: 1000 },
    }
    const updated = updateProject(store, 'p1', { name: 'New', status: 'active' })
    expect(updated.p1.name).toBe('New')
    expect(updated.p1.status).toBe('active')
    expect(updated.p1.updatedAt).toBeGreaterThan(1000)
  })

  it('returns same store when updating non-existent project', () => {
    const store: ProjectStore = {}
    const result = updateProject(store, 'missing', { name: 'Test' })
    expect(result).toBe(store)
  })

  it('deletes a project', () => {
    const store: ProjectStore = {
      p1: { id: 'p1', name: 'Test', description: '', status: 'planning', priority: 'medium', agentId: null, createdAt: 1000, updatedAt: 1000 },
    }
    const result = deleteProject(store, 'p1')
    expect(Object.keys(result)).toHaveLength(0)
  })
})
