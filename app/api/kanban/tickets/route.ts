import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getKanbanSnapshot, saveKanbanSnapshot } from '@/lib/kanban/server-store'
import { sanitizeSnapshot } from '@/lib/kanban/store'

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
    const snapshot = sanitizeSnapshot(body)
    saveKanbanSnapshot(snapshot)
    return NextResponse.json({ ok: true, ...snapshot })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to save kanban tickets')
  }
}
