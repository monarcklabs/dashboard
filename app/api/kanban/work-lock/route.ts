import { NextRequest } from 'next/server'
import { acquireWorkLock, releaseWorkLock, isWorkLocked } from '@/lib/kanban/chat-store'
import { apiErrorResponse } from '@/lib/api-error'

const TICKET_ID_RE = /^[a-zA-Z0-9_-]+$/

/**
 * POST /api/kanban/work-lock
 * Body: { ticketId, owner, action: "acquire" | "release" }
 *
 * Returns { acquired: boolean } for acquire, { released: boolean } for release.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { ticketId, owner, action } = body

    if (typeof ticketId !== 'string' || !TICKET_ID_RE.test(ticketId)) {
      return Response.json({ error: 'Invalid ticketId' }, { status: 400 })
    }
    if (typeof owner !== 'string' || !owner) {
      return Response.json({ error: 'owner required' }, { status: 400 })
    }

    if (action === 'acquire') {
      const acquired = acquireWorkLock(ticketId, owner)
      return Response.json({ acquired })
    }

    if (action === 'release') {
      const released = releaseWorkLock(ticketId, owner)
      return Response.json({ released })
    }

    return Response.json({ error: 'action must be "acquire" or "release"' }, { status: 400 })
  } catch (err) {
    return apiErrorResponse(err, 'Work lock operation failed')
  }
}

/**
 * GET /api/kanban/work-lock?ticketId=xxx
 * Returns { locked: boolean, owner?: string }
 */
export async function GET(req: NextRequest) {
  try {
    const ticketId = req.nextUrl.searchParams.get('ticketId')
    if (!ticketId || !TICKET_ID_RE.test(ticketId)) {
      return Response.json({ error: 'Invalid ticketId' }, { status: 400 })
    }
    return Response.json(isWorkLocked(ticketId))
  } catch (err) {
    return apiErrorResponse(err, 'Work lock check failed')
  }
}
