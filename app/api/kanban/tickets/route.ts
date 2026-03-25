import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getKanbanSnapshot, saveKanbanSnapshot } from '@/lib/kanban/server-store'
import { mergeTicketSnapshots, sanitizeSnapshot } from '@/lib/kanban/store'

export async function GET() {
  try {
    return NextResponse.json(getKanbanSnapshot())
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load kanban tickets')
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const incomingSnapshot = sanitizeSnapshot(body)
    const mergedSnapshot = mergeTicketSnapshots(getKanbanSnapshot(), incomingSnapshot)
    saveKanbanSnapshot(mergedSnapshot)
    return NextResponse.json({ ok: true, ...mergedSnapshot })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to save kanban tickets')
  }
}
