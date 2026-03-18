import { google } from 'googleapis'
import { getGoogleWorkspaceConfig, type GoogleWorkspaceConfig } from '@/lib/integrations'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  url: string
  iconLink: string
}

function buildDriveAuth(config: GoogleWorkspaceConfig, { impersonate = true } = {}) {
  if (config.authMethod === 'gws_service_account' && config.saJson) {
    const credentials = JSON.parse(config.saJson)
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      clientOptions: impersonate && config.impersonateEmail
        ? { subject: config.impersonateEmail }
        : undefined,
    })
  }

  return new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
}

export interface DriveFolderFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
}

export interface DriveFolderItem {
  id: string
  name: string
  mimeType: string
  isFolder: boolean
  url: string | null  // webViewLink for files, null for folders
  modifiedTime: string
}

/**
 * List all files (non-recursive) in a Drive folder. Skips folders.
 */
export async function listFolderFiles(
  folderId: string,
  config: GoogleWorkspaceConfig
): Promise<DriveFolderFile[]> {
  const auth = buildDriveAuth(config, { impersonate: false })
  const drive = google.drive({ version: 'v3', auth })

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
    fields: 'files(id, name, mimeType, modifiedTime)',
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? '',
    name: f.name ?? '',
    mimeType: f.mimeType ?? '',
    modifiedTime: f.modifiedTime ?? '',
  }))
}

/**
 * List files AND folders (non-recursive) inside a Drive folder.
 * Folders are returned first, then files, both sorted by name ascending.
 * Pass folderId = 'root' to list My Drive root.
 */
export async function listFolderContents(
  folderId: string,
  config: GoogleWorkspaceConfig
): Promise<DriveFolderItem[]> {
  const auth = buildDriveAuth(config, { impersonate: false })
  const drive = google.drive({ version: 'v3', auth })

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink, modifiedTime)',
    pageSize: 200,
    orderBy: 'folder,name',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  return (res.data.files ?? []).map((f) => {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder'
    return {
      id: f.id ?? '',
      name: f.name ?? '',
      mimeType: f.mimeType ?? '',
      isFolder,
      url: isFolder ? null : (f.webViewLink ?? ''),
      modifiedTime: f.modifiedTime ?? '',
    }
  })
}

const GOOGLE_EXPORT_MIME: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
}

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml']

/**
 * Download a Drive file as text. Google Workspace files are exported as
 * plain text/CSV. Binary files return null (skipped).
 */
export async function downloadDriveFile(
  fileId: string,
  mimeType: string,
  config: GoogleWorkspaceConfig
): Promise<string | null> {
  const auth = buildDriveAuth(config, { impersonate: false })
  const drive = google.drive({ version: 'v3', auth })

  const exportMime = GOOGLE_EXPORT_MIME[mimeType]
  if (exportMime) {
    const res = await drive.files.export(
      { fileId, mimeType: exportMime },
      { responseType: 'text' }
    )
    return typeof res.data === 'string' ? res.data : String(res.data)
  }

  const isText = TEXT_MIME_PREFIXES.some((p) => mimeType.startsWith(p))
  if (!isText) return null

  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'text' }
  )
  return typeof res.data === 'string' ? res.data : String(res.data)
}

/**
 * Search Google Drive files by name. Returns up to 20 results sorted by
 * most recently viewed. Returns an empty array if Drive is not configured.
 */
export async function searchDriveFiles(query: string): Promise<DriveFile[]> {
  const config = getGoogleWorkspaceConfig()
  if (!config?.driveEnabled) return []

  const auth = buildDriveAuth(config)
  const drive = google.drive({ version: 'v3', auth })

  const escapedQuery = query.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const q = query.trim()
    ? `name contains '${escapedQuery}' and trashed = false`
    : 'trashed = false'

  const res = await drive.files.list({
    q,
    fields: 'files(id, name, mimeType, webViewLink, iconLink)',
    pageSize: 20,
    orderBy: 'viewedByMeTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? '',
    name: f.name ?? '',
    mimeType: f.mimeType ?? '',
    url: f.webViewLink ?? '',
    iconLink: f.iconLink ?? '',
  }))
}
