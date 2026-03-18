import { NextResponse } from 'next/server'
import { listFolderContents } from '@/lib/google-drive'
import { getGoogleWorkspaceConfig } from '@/lib/integrations'

/**
 * GET /api/drive/folder?id=FOLDER_ID
 *
 * Lists files and folders inside the given Drive folder.
 * If no id is provided, defaults to 'root' (My Drive root).
 * Returns { items: DriveFolderItem[] }.
 * Returns an empty array if Drive is not configured.
 */
export async function GET(request: Request) {
  const config = getGoogleWorkspaceConfig()
  if (!config?.driveEnabled) {
    return NextResponse.json({ items: [] })
  }

  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get('id') ?? 'root'

  try {
    const items = await listFolderContents(folderId, config)
    return NextResponse.json({ items })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Drive folder list error:', message)
    return NextResponse.json({ items: [], error: message }, { status: 500 })
  }
}
