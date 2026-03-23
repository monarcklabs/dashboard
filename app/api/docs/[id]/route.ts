import { getDocEntry } from '@/lib/docs'
import { apiErrorResponse } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const doc = getDocEntry(decodeURIComponent(id))
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    return NextResponse.json(doc)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load document')
  }
}
