import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { requireEnv } from '@/lib/env'
import type { KanbanStore } from '@/lib/kanban/store'
import { sanitizeStore } from '@/lib/kanban/store'

function getStorePath(): string {
  return path.resolve(requireEnv('WORKSPACE_PATH'), '..', 'kanban', 'tickets.json')
}

export function getKanbanStore(): KanbanStore {
  const filePath = getStorePath()
  if (!existsSync(filePath)) return {}

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown
    return sanitizeStore(raw)
  } catch {
    return {}
  }
}

export function saveKanbanStore(store: KanbanStore): void {
  const filePath = getStorePath()
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(store, null, 2) + '\n', 'utf-8')
}
