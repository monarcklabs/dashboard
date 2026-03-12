import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import path from 'path'
import { requireEnv } from '@/lib/env'

/** Serializable chat message (no isStreaming — UI-only field) */
export interface StoredChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/** Derive the chats directory from WORKSPACE_PATH */
function getChatsDir(): string {
  return path.resolve(requireEnv('WORKSPACE_PATH'), '..', 'kanban', 'chats')
}

/**
 * Parse a single JSONL line into a StoredChatMessage.
 * Returns null if the line can't be parsed or is missing required fields.
 */
function parseLine(line: string): StoredChatMessage | null {
  if (!line.trim()) return null
  try {
    const obj = JSON.parse(line)
    if (typeof obj.id !== 'string' || !obj.id) return null
    if (obj.role !== 'user' && obj.role !== 'assistant') return null
    if (typeof obj.content !== 'string') return null
    return {
      id: obj.id,
      role: obj.role,
      content: obj.content,
      timestamp: typeof obj.timestamp === 'number' ? obj.timestamp : 0,
    }
  } catch {
    return null
  }
}

/**
 * Read chat messages for a ticket from its JSONL file.
 * Returns StoredChatMessage[] sorted oldest-first by timestamp.
 */
export function getChatMessages(ticketId: string): StoredChatMessage[] {
  const chatsDir = getChatsDir()
  const filePath = path.join(chatsDir, `${ticketId}.jsonl`)

  if (!existsSync(filePath)) return []

  try {
    const content = readFileSync(filePath, 'utf-8')
    const messages: StoredChatMessage[] = []
    const seenIds = new Set<string>()
    const seenSignatures = new Set<string>()
    for (const line of content.split('\n')) {
      const msg = parseLine(line)
      if (!msg) continue
      // Deduplicate by ID and by role+content (multi-browser writes)
      if (seenIds.has(msg.id)) continue
      const sig = `${msg.role}:${normalizeContent(msg.content)}`
      if (seenSignatures.has(sig)) continue
      seenIds.add(msg.id)
      seenSignatures.add(sig)
      messages.push(msg)
    }
    messages.sort((a, b) => a.timestamp - b.timestamp)
    return messages
  } catch {
    return []
  }
}

/**
 * Normalize content for dedup comparison: trim + collapse whitespace + lowercase.
 */
function normalizeContent(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Append chat messages to a ticket's JSONL file.
 * Creates the chats directory and file if they don't exist.
 * Deduplicates by message ID and by content similarity (handles
 * multiple browsers generating independent messages for the same exchange).
 */
export function appendChatMessages(ticketId: string, messages: StoredChatMessage[]): void {
  const chatsDir = getChatsDir()
  mkdirSync(chatsDir, { recursive: true })

  const filePath = path.join(chatsDir, `${ticketId}.jsonl`)

  // Deduplicate against existing messages if file exists
  let newMessages = messages
  if (existsSync(filePath)) {
    const existing = getChatMessages(ticketId)
    const existingIds = new Set(existing.map(m => m.id))
    // Build a set of role+content signatures for content-based dedup.
    // Two browsers sending the same user message generate different IDs
    // but identical role+content — skip those.
    const existingSignatures = new Set(
      existing.map(m => `${m.role}:${normalizeContent(m.content)}`)
    )
    newMessages = messages.filter(m =>
      !existingIds.has(m.id) && !existingSignatures.has(`${m.role}:${normalizeContent(m.content)}`)
    )
    if (newMessages.length === 0) return
  }
  const lines = newMessages.map(m => JSON.stringify({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
  }))

  appendFileSync(filePath, lines.join('\n') + '\n', 'utf-8')
}

/* ── Work lock (prevents multiple browsers executing the same ticket) ── */

const LOCK_STALE_MS = 180_000 // 3 minutes — auto-expire stale locks

interface WorkLock {
  owner: string   // opaque client ID
  ticketId: string
  acquiredAt: number
}

function getLocksDir(): string {
  return path.resolve(requireEnv('WORKSPACE_PATH'), '..', 'kanban', 'locks')
}

function lockPath(ticketId: string): string {
  return path.join(getLocksDir(), `${ticketId}.lock`)
}

/**
 * Try to acquire an exclusive work lock for a ticket.
 * Returns true if the lock was acquired, false if another client holds it.
 * Stale locks (older than LOCK_STALE_MS) are automatically broken.
 */
export function acquireWorkLock(ticketId: string, owner: string): boolean {
  const dir = getLocksDir()
  mkdirSync(dir, { recursive: true })
  const fp = lockPath(ticketId)

  // Check existing lock
  if (existsSync(fp)) {
    try {
      const existing: WorkLock = JSON.parse(readFileSync(fp, 'utf-8'))
      // Same owner can re-acquire (idempotent)
      if (existing.owner === owner) return true
      // Break stale locks
      if (Date.now() - existing.acquiredAt < LOCK_STALE_MS) return false
      // Stale — fall through to overwrite
    } catch {
      // Corrupt lock file — overwrite
    }
  }

  const lock: WorkLock = { owner, ticketId, acquiredAt: Date.now() }
  writeFileSync(fp, JSON.stringify(lock), 'utf-8')
  return true
}

/**
 * Release a work lock. Only the owner can release it.
 * Returns true if released, false if not owned by this client.
 */
export function releaseWorkLock(ticketId: string, owner: string): boolean {
  const fp = lockPath(ticketId)
  if (!existsSync(fp)) return true

  try {
    const existing: WorkLock = JSON.parse(readFileSync(fp, 'utf-8'))
    if (existing.owner !== owner) return false
  } catch {
    // Corrupt — safe to remove
  }

  try { unlinkSync(fp) } catch { /* already gone */ }
  return true
}

/**
 * Check if a ticket has an active (non-stale) work lock.
 */
export function isWorkLocked(ticketId: string): { locked: boolean; owner?: string } {
  const fp = lockPath(ticketId)
  if (!existsSync(fp)) return { locked: false }

  try {
    const existing: WorkLock = JSON.parse(readFileSync(fp, 'utf-8'))
    if (Date.now() - existing.acquiredAt >= LOCK_STALE_MS) {
      try { unlinkSync(fp) } catch { /* race */ }
      return { locked: false }
    }
    return { locked: true, owner: existing.owner }
  } catch {
    return { locked: false }
  }
}
