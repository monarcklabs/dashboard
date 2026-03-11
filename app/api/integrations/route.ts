import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getIntegrationsSummary } from '@/lib/integrations'

export async function GET() {
  try {
    return NextResponse.json(getIntegrationsSummary())
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load integrations')
  }
}
