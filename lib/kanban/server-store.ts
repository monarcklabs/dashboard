import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { requireEnv } from '@/lib/env'
import type { KanbanSnapshot, KanbanStore } from '@/lib/kanban/store'
import { sanitizeSnapshot } from '@/lib/kanban/store'

function getStorePath(): string {
  return path.resolve(requireEnv('WORKSPACE_PATH'), '..', 'kanban', 'tickets.json')
}

export function getKanbanSnapshot(): KanbanSnapshot {
  const filePath = getStorePath()
  if (!existsSync(filePath)) return { tickets: {}, deleted: {} }

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as unknown
    return sanitizeSnapshot(raw)
  } catch {
    return { tickets: {}, deleted: {} }
  }
}

export function getKanbanStore(): KanbanStore {
  return getKanbanSnapshot().tickets
}

export function saveKanbanSnapshot(snapshot: KanbanSnapshot): void {
  const filePath = getStorePath()
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8')
}

export function saveKanbanStore(store: KanbanStore): void {
  saveKanbanSnapshot({ tickets: store, deleted: {} })
}
