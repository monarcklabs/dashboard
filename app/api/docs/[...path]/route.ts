import { getDocContent, getDocAbsolutePath, PathTraversalError } from '@/lib/docs'
import { apiErrorResponse } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const relativePath = path.join('/')

    // Check if this is a binary file request (pdf, xlsx)
    const ext = relativePath.split('.').pop()?.toLowerCase()
    if (ext === 'pdf' || ext === 'xlsx') {
      const absPath = getDocAbsolutePath(relativePath)
      if (!absPath) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }

      const data = readFileSync(absPath)
      const contentType = ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const filename = relativePath.split('/').pop() ?? 'download'

      return new Response(data, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(data.length),
        },
      })
    }

    // Text file — return JSON with content
    const result = getDocContent(relativePath)
    if (!result) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PathTraversalError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return apiErrorResponse(err, 'Failed to load document')
  }
}
