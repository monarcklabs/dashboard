/**
 * Docs browser data source.
 * Aggregates client-facing documents from two sources:
 *   1. Kanban tickets with completed work results (agent deliverables)
 *   2. Cron runs with summary output (scheduled reports)
 */

import type { DocEntry, CronRun } from '@/lib/types'
import type { KanbanTicket } from '@/lib/kanban/types'
import { getKanbanStore } from '@/lib/kanban/server-store'
import { getCronRuns } from '@/lib/cron-runs'

// ── Kanban ticket documents ──────────────────────────────────

/** Tickets that have work output worth showing in the docs browser */
function isDocWorthy(ticket: KanbanTicket): boolean {
  if (!ticket.workResult) return false
  if (ticket.workState !== 'done') return false
  // Only show tickets in review or done status (completed work)
  return ticket.status === 'review' || ticket.status === 'done'
}

function ticketToDoc(ticket: KanbanTicket): DocEntry {
  const tags: string[] = ['kanban']
  if (ticket.status) tags.push(ticket.status)
  if (ticket.assigneeId) tags.push(ticket.assigneeId)

  return {
    id: `kanban-${ticket.id}`,
    title: ticket.title,
    source: 'kanban',
    content: ticket.workResult!,
    agentId: ticket.assigneeId,
    date: new Date(ticket.updatedAt).toISOString(),
    tags,
    ticketStatus: ticket.status,
    projectId: ticket.projectId,
    jobId: null,
    cronStatus: null,
    deliveryStatus: null,
  }
}

// ── Cron run documents ───────────────────────────────────────

/** Cron runs that produced meaningful output */
function isCronDocWorthy(run: CronRun): boolean {
  if (!run.summary) return false
  if (run.status !== 'ok') return false
  // Require some meaningful content (not just a one-liner status)
  return run.summary.length > 100
}

function cronRunToDoc(run: CronRun): DocEntry {
  const tags: string[] = ['cron']
  if (run.deliveryStatus) tags.push(run.deliveryStatus)

  // Derive a readable name from jobId
  // e.g. "a1b2c3d4-life-os-morning-report-001" → "Morning Report"
  const namePart = run.jobId
    .replace(/^[a-f0-9]+-/, '')     // strip UUID prefix
    .replace(/-\d+$/, '')            // strip trailing number
    .replace(/^life-os-/, '')        // strip common prefix
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  return {
    id: `cron-${run.jobId}-${run.ts}`,
    title: namePart || run.jobId,
    source: 'cron',
    content: run.summary!,
    agentId: null,
    date: new Date(run.ts).toISOString(),
    tags,
    ticketStatus: null,
    projectId: null,
    jobId: run.jobId,
    cronStatus: run.status,
    deliveryStatus: run.deliveryStatus,
  }
}

// ── Public API ───────────────────────────────────────────────

/**
 * Returns all document entries from kanban tickets and cron runs,
 * sorted by date descending (most recent first).
 */
export function getDocEntries(): DocEntry[] {
  const docs: DocEntry[] = []

  // 1. Kanban tickets with work results
  try {
    const store = getKanbanStore()
    for (const ticket of Object.values(store)) {
      if (isDocWorthy(ticket)) {
        docs.push(ticketToDoc(ticket))
      }
    }
  } catch {
    // Kanban store unavailable -- continue with cron data
  }

  // 2. Cron runs with summaries
  try {
    const runs = getCronRuns()
    for (const run of runs) {
      if (isCronDocWorthy(run)) {
        docs.push(cronRunToDoc(run))
      }
    }
  } catch {
    // Cron runs unavailable -- continue with what we have
  }

  // Sort by date descending
  docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return docs
}

/**
 * Returns a single document entry by ID.
 */
export function getDocEntry(id: string): DocEntry | null {
  const docs = getDocEntries()
  return docs.find(d => d.id === id) ?? null
}
