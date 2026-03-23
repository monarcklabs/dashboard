import { getDocEntries } from '@/lib/docs'
import { apiErrorResponse } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const docs = getDocEntries()
    return NextResponse.json({ docs })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load documents')
  }
}
