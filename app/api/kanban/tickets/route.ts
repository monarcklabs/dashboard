import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getKanbanStore, saveKanbanStore } from '@/lib/kanban/server-store'
import { sanitizeStore } from '@/lib/kanban/store'

export async function GET() {
  try {
    return NextResponse.json(getKanbanStore())
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load kanban tickets')
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const store = sanitizeStore(body)
    saveKanbanStore(store)
    return NextResponse.json({ ok: true, tickets: store })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to save kanban tickets')
  }
}
