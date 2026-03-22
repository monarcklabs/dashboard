import { getDocFiles } from '@/lib/docs'
import { apiErrorResponse } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const files = getDocFiles()
    return NextResponse.json({ files })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load document files')
  }
}
