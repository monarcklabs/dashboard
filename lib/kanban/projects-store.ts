import type { Project, ProjectStatus, TicketPriority } from './types'
import { generateId } from '../id'

export type ProjectStore = Record<string, Project>

const STORAGE_KEY = 'clawport-projects'

const VALID_STATUSES = new Set<ProjectStatus>(['planning', 'active', 'complete'])
const VALID_PRIORITIES = new Set<TicketPriority>(['low', 'medium', 'high'])

function sanitizeProject(id: string, raw: Record<string, unknown>): Project | null {
  if (typeof raw.name !== 'string' || !raw.name) return null

  const status = (VALID_STATUSES.has(raw.status as ProjectStatus) ? raw.status : 'planning') as ProjectStatus
  const priority = (VALID_PRIORITIES.has(raw.priority as TicketPriority) ? raw.priority : 'medium') as TicketPriority

  return {
    id,
    name: raw.name as string,
    description: typeof raw.description === 'string' ? raw.description : '',
    status,
    priority,
    agentId: typeof raw.agentId === 'string' ? raw.agentId : null,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : (typeof raw.createdAt === 'number' ? raw.createdAt : 0),
  }
}

export function sanitizeProjectStore(raw: unknown): ProjectStore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const parsed = raw as Record<string, Record<string, unknown>>
  const store: ProjectStore = {}

  for (const id of Object.keys(parsed)) {
    const project = sanitizeProject(id, parsed[id])
    if (project) store[id] = project
  }

  return store
}

export function mergeProjectStores(base: ProjectStore, incoming: ProjectStore): ProjectStore {
  const merged: ProjectStore = { ...base }

  for (const [id, project] of Object.entries(incoming)) {
    const existing = merged[id]
    if (!existing || project.updatedAt >= existing.updatedAt) {
      merged[id] = project
    }
  }

  return merged
}

export function loadProjects(): ProjectStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return sanitizeProjectStore(JSON.parse(raw))
  } catch {
    return {}
  }
}

export function saveProjects(store: ProjectStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {}
}

export function createProject(
  store: ProjectStore,
  project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>,
): ProjectStore {
  const id = generateId()
  const now = Date.now()
  return {
    ...store,
    [id]: {
      ...project,
      id,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export function updateProject(
  store: ProjectStore,
  id: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt'>>,
): ProjectStore {
  const existing = store[id]
  if (!existing) return store
  return {
    ...store,
    [id]: { ...existing, ...updates, updatedAt: Date.now() },
  }
}

export function deleteProject(store: ProjectStore, id: string): ProjectStore {
  const next = { ...store }
  delete next[id]
  return next
}
