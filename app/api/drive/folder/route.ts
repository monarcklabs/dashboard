import { NextResponse } from 'next/server'
import { listFolderContents } from '@/lib/google-drive'
import { getGoogleWorkspaceConfig, getConfiguredDriveFolderId } from '@/lib/integrations'

/**
 * GET /api/drive/folder?id=FOLDER_ID
 *
 * Lists files and folders inside the given Drive folder.
 * If no id is provided, defaults to the configured drive_library folder
 * (from integrations.json or openclaw.json).
 * Returns { items: DriveFolderItem[], resolvedId: string }.
 * Returns an empty array if Drive is not configured.
 */
export async function GET(request: Request) {
  const config = getGoogleWorkspaceConfig()
  if (!config?.driveEnabled) {
    return NextResponse.json({ items: [], resolvedId: null })
  }

  const { searchParams } = new URL(request.url)
  const rawId = searchParams.get('id')

  let folderId: string
  if (rawId) {
    folderId = rawId
  } else {
    folderId = getConfiguredDriveFolderId() ?? 'root'
  }

  try {
    const items = await listFolderContents(folderId, config)
    return NextResponse.json({ items, resolvedId: folderId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Drive folder list error:', message)
    return NextResponse.json({ items: [], resolvedId: folderId, error: message }, { status: 500 })
  }
}
