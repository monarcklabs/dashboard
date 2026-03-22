import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getProjectStore, saveProjectStore } from '@/lib/kanban/projects-server-store'
import { sanitizeProjectStore } from '@/lib/kanban/projects-store'

export async function GET() {
  try {
    return NextResponse.json(getProjectStore())
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load projects')
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const store = sanitizeProjectStore(body)
    saveProjectStore(store)
    return NextResponse.json({ ok: true, projects: store })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to save projects')
  }
}
