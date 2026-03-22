import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { requireEnv } from '@/lib/env'
import type { ProjectStore } from '@/lib/kanban/projects-store'
import { sanitizeProjectStore } from '@/lib/kanban/projects-store'

function getStorePath(): string {
  return path.resolve(requireEnv('WORKSPACE_PATH'), '..', 'kanban', 'projects.json')
}

export function getProjectStore(): ProjectStore {
  const filePath = getStorePath()
  if (!existsSync(filePath)) return {}

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown
    return sanitizeProjectStore(raw)
  } catch {
    return {}
  }
}

export function saveProjectStore(store: ProjectStore): void {
  const filePath = getStorePath()
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(store, null, 2) + '\n', 'utf-8')
}
