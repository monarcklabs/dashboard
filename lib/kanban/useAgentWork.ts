'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { KanbanTicket, TicketStatus } from './types'
import type { KanbanStore } from './store'
import { executeWork, getWorkPrompt, parseWorkDisposition, persistWorkChat } from './automation'
import { generateId } from '../id'

const MAX_CONCURRENT_WORK = 3

// Unique ID for this browser tab — used as lock owner
const TAB_OWNER = generateId()

interface UseAgentWorkOptions {
  tickets: KanbanStore
  onUpdateTicket: (ticketId: string, updates: Partial<KanbanTicket>) => void
}

async function tryAcquireLock(ticketId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/kanban/work-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, owner: TAB_OWNER, action: 'acquire' }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return data.acquired === true
  } catch {
    return false
  }
}

async function releaseLock(ticketId: string): Promise<void> {
  try {
    await fetch('/api/kanban/work-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, owner: TAB_OWNER, action: 'release' }),
    })
  } catch { /* best-effort */ }
}

export function useAgentWork({ tickets, onUpdateTicket }: UseAgentWorkOptions) {
  const activeWork = useRef<Set<string>>(new Set())
  const abortControllers = useRef<Map<string, AbortController>>(new Map())
  const unmounted = useRef(false)

  // Clean up on unmount: abort all in-flight work and release locks
  useEffect(() => {
    unmounted.current = false
    return () => {
      unmounted.current = true
      for (const [ticketId, controller] of abortControllers.current) {
        controller.abort()
        releaseLock(ticketId)
      }
      abortControllers.current.clear()
      activeWork.current.clear()
    }
  }, [])

  const runWork = useCallback(async (ticket: KanbanTicket) => {
    const { id, assigneeId } = ticket
    if (!assigneeId) return

    // Acquire server-side lock — if another browser already claimed this ticket, bail
    const locked = await tryAcquireLock(id)
    if (!locked) {
      activeWork.current.delete(id)
      // Another browser is working on it — revert to idle so we don't block it
      onUpdateTicket(id, { workState: 'idle' })
      return
    }

    const controller = new AbortController()
    abortControllers.current.set(id, controller)

    // Move to in-progress + set working state
    onUpdateTicket(id, {
      status: 'in-progress' as TicketStatus,
      workState: 'working',
      workStartedAt: Date.now(),
      workError: null,
    })

    const result = await executeWork(assigneeId, ticket, undefined, controller.signal)

    // Release lock regardless of outcome
    await releaseLock(id)

    // Bail if component unmounted while we were working
    if (unmounted.current) return

    abortControllers.current.delete(id)

    if (result.success) {
      const parsed = parseWorkDisposition(result.content)

      // Save chat history so TicketDetailPanel picks it up
      const prompt = getWorkPrompt(ticket)
      const persisted = await persistWorkChat(id, prompt, parsed.content)

      const nextStatus: TicketStatus =
        parsed.disposition === 'working'
          ? 'in-progress'
          : 'review'

      onUpdateTicket(id, {
        status: nextStatus,
        workState: 'done',
        workResult: parsed.content,
        workError: persisted ? null : 'Saved work result, but chat history did not persist.',
      })
    } else {
      onUpdateTicket(id, {
        workState: 'failed',
        workError: result.error || 'Agent work failed',
      })
    }

    activeWork.current.delete(id)
  }, [onUpdateTicket])

  // Recover tickets stuck in working/starting state (e.g. browser closed mid-work)
  // If workStartedAt is older than timeout + 30s buffer and not actively tracked, mark as failed.
  const STALE_THRESHOLD_MS = 150_000 // 2.5 min (timeout is 2 min)

  useEffect(() => {
    const now = Date.now()
    for (const ticket of Object.values(tickets)) {
      if (
        (ticket.workState === 'working' || ticket.workState === 'starting') &&
        ticket.workStartedAt &&
        now - ticket.workStartedAt > STALE_THRESHOLD_MS &&
        !activeWork.current.has(ticket.id)
      ) {
        onUpdateTicket(ticket.id, {
          workState: 'failed',
          workError: 'Agent work appears stuck (no response received). You can retry.',
        })
      }
    }
  }, [tickets, onUpdateTicket])

  // Scan for eligible tickets
  useEffect(() => {
    const eligible = Object.values(tickets).filter(
      (t) => t.status === 'todo' && t.assigneeId && t.workState === 'idle',
    )

    for (const ticket of eligible) {
      if (activeWork.current.has(ticket.id)) continue
      if (activeWork.current.size >= MAX_CONCURRENT_WORK) break

      // Mark as active immediately to prevent double-execution
      activeWork.current.add(ticket.id)

      // Set starting state synchronously to prevent re-triggers on next render
      onUpdateTicket(ticket.id, { workState: 'starting' })

      // Fire async work (lock acquisition happens inside runWork)
      runWork(ticket)
    }
  }, [tickets, onUpdateTicket, runWork])

  const isWorking = useCallback(
    (ticketId: string): boolean => activeWork.current.has(ticketId),
    [],
  )

  return { isWorking }
}
