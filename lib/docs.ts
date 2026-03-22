/**
 * Server-side workspace document scanner.
 * Discovers document files in the OpenClaw workspace for the Docs browser.
 * Follows the lib/memory.ts pattern: requireEnv() inside functions, fs sync ops.
 */

import type { DocFileInfo, DocFileType, DocCategory } from '@/lib/types'
import { readFileSync, existsSync, statSync, readdirSync } from 'fs'
import { join, extname, relative, resolve } from 'path'
import { requireEnv } from '@/lib/env'

// ── Constants ────────────────────────────────────────────────────

const MAX_DEPTH = 5
const MAX_FILES = 500

/** File extensions we scan for */
const DOC_EXTENSIONS = new Set(['.md', '.html', '.json', '.csv', '.txt', '.pdf', '.xlsx'])

/** Directories to skip entirely */
const SKIP_DIRS = new Set(['node_modules', '.git', '.openclaw', 'memory', '.DS_Store'])

/** Files to skip (owned by other features) */
const SKIP_FILES = new Set(['SOUL.md', 'MEMORY.md', 'openclaw.json'])

// ── Helpers ──────────────────────────────────────────────────────

function extToFileType(ext: string): DocFileType {
  const map: Record<string, DocFileType> = {
    '.md': 'md',
    '.html': 'html',
    '.json': 'json',
    '.csv': 'csv',
    '.txt': 'txt',
    '.pdf': 'pdf',
    '.xlsx': 'xlsx',
  }
  return map[ext] ?? 'unknown'
}

function deriveCategory(relativePath: string): DocCategory {
  const parts = relativePath.split('/')
  if (parts.length === 1) return 'root'
  if (parts[0] === 'agents') return 'agent'
  if (parts.includes('docs')) return 'docs'
  if (parts.includes('output')) return 'output'
  return 'other'
}

function extractAgentId(relativePath: string): string | null {
  const match = relativePath.match(/^agents\/([^/]+)\//)
  return match ? match[1] : null
}

function buildTags(fileType: DocFileType, category: DocCategory, agentId: string | null): string[] {
  const tags: string[] = [fileType, category]
  if (agentId) tags.push(agentId)
  return tags
}

// ── Recursive scanner ────────────────────────────────────────────

function scanDir(
  dir: string,
  workspacePath: string,
  files: DocFileInfo[],
  depth: number
): void {
  if (depth > MAX_DEPTH || files.length >= MAX_FILES) return

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    if (files.length >= MAX_FILES) return

    const fullPath = join(dir, entry)
    const relPath = relative(workspacePath, fullPath)

    // Skip hidden entries (except we already checked SKIP_DIRS)
    if (entry.startsWith('.') && !SKIP_DIRS.has(entry)) continue
    if (SKIP_DIRS.has(entry)) continue
    if (SKIP_FILES.has(entry)) continue

    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      // Also skip agent SOUL.md directories that only contain SOUL.md
      scanDir(fullPath, workspacePath, files, depth + 1)
      continue
    }

    if (!stat.isFile()) continue

    const ext = extname(entry).toLowerCase()
    if (!DOC_EXTENSIONS.has(ext)) continue

    const fileType = extToFileType(ext)
    const category = deriveCategory(relPath)
    const agentId = extractAgentId(relPath)

    files.push({
      name: entry,
      relativePath: relPath,
      fileType,
      category,
      agentId,
      tags: buildTags(fileType, category, agentId),
      sizeBytes: stat.size,
      lastModified: stat.mtime.toISOString(),
    })
  }
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Discovers document files in the workspace.
 * Returns metadata only (no content) for fast listing.
 */
export function getDocFiles(): DocFileInfo[] {
  const workspacePath = requireEnv('WORKSPACE_PATH')
  if (!existsSync(workspacePath)) return []

  const files: DocFileInfo[] = []
  scanDir(workspacePath, workspacePath, files, 0)

  // Sort by lastModified descending (most recent first)
  files.sort((a, b) =>
    new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  )

  return files
}

/**
 * Reads a single document file's content.
 * Returns null if not found. Throws on path traversal attempts.
 */
export function getDocContent(relativePath: string): { file: DocFileInfo; content: string } | null {
  if (relativePath.includes('..')) {
    throw new PathTraversalError('Path traversal not allowed')
  }

  const workspacePath = requireEnv('WORKSPACE_PATH')
  const fullPath = join(workspacePath, relativePath)

  // Ensure resolved path is still within workspace
  const resolved = resolve(fullPath)
  const resolvedWorkspace = resolve(workspacePath)
  if (!resolved.startsWith(resolvedWorkspace + '/') && resolved !== resolvedWorkspace) {
    throw new PathTraversalError('Path traversal not allowed')
  }

  if (!existsSync(fullPath)) return null

  let stat
  try {
    stat = statSync(fullPath)
  } catch {
    return null
  }
  if (!stat.isFile()) return null

  const name = fullPath.split('/').pop() ?? relativePath
  const ext = extname(name).toLowerCase()
  const fileType = extToFileType(ext)
  const category = deriveCategory(relativePath)
  const agentId = extractAgentId(relativePath)

  // For binary files, return empty content
  const isBinary = fileType === 'pdf' || fileType === 'xlsx'
  let content = ''
  if (!isBinary) {
    try {
      content = readFileSync(fullPath, 'utf-8')
    } catch {
      return null
    }
  }

  return {
    file: {
      name,
      relativePath,
      fileType,
      category,
      agentId,
      tags: buildTags(fileType, category, agentId),
      sizeBytes: stat.size,
      lastModified: stat.mtime.toISOString(),
    },
    content,
  }
}

/**
 * Returns the absolute path for a document (for binary file streaming).
 */
export function getDocAbsolutePath(relativePath: string): string | null {
  if (relativePath.includes('..')) {
    throw new PathTraversalError('Path traversal not allowed')
  }

  const workspacePath = requireEnv('WORKSPACE_PATH')
  const fullPath = join(workspacePath, relativePath)

  const resolved = resolve(fullPath)
  const resolvedWorkspace = resolve(workspacePath)
  if (!resolved.startsWith(resolvedWorkspace + '/') && resolved !== resolvedWorkspace) {
    throw new PathTraversalError('Path traversal not allowed')
  }

  if (!existsSync(fullPath)) return null
  return fullPath
}

// ── Error types ──────────────────────────────────────────────────

export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathTraversalError'
  }
}
