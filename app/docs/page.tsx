'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, FileJson, FileSpreadsheet, File, Search, Download, Printer } from 'lucide-react'
import type { DocFileInfo, DocFileType, DocCategory } from '@/lib/types'
import { DocViewer } from '@/components/docs/DocViewer'
import { exportAsPdf, exportAsDocx } from '@/lib/export-markdown'
import { saveAs } from 'file-saver'

/* ─── Constants ───────────────────────────────────────────────── */

const FILE_TYPE_LABELS: Record<DocFileType, string> = {
  md: '.md',
  html: '.html',
  json: '.json',
  csv: '.csv',
  txt: '.txt',
  pdf: '.pdf',
  xlsx: '.xlsx',
  unknown: 'other',
}

const CATEGORY_LABELS: Record<DocCategory, string> = {
  root: 'Root',
  agent: 'Agent',
  docs: 'Docs',
  output: 'Output',
  other: 'Other',
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function fileIcon(type: DocFileType) {
  switch (type) {
    case 'json':
      return <FileJson size={14} />
    case 'csv':
    case 'xlsx':
      return <FileSpreadsheet size={14} />
    case 'md':
    case 'html':
    case 'txt':
      return <FileText size={14} />
    default:
      return <File size={14} />
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const dateStr = d.toISOString().slice(0, 10)

  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function BackArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="10 3 5 8 10 13" />
    </svg>
  )
}

/* ─── Component ───────────────────────────────────────────────── */

export default function DocsPage() {
  const [files, setFiles] = useState<DocFileInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<DocFileInfo | null>(null)
  const [selectedContent, setSelectedContent] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocFileType | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<DocCategory | null>(null)
  const [mobileShowContent, setMobileShowContent] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  /* ── Load file list ─────────────────────────────────────────── */

  useEffect(() => {
    fetch('/api/docs')
      .then((r) => r.json())
      .then((data) => {
        setFiles(data.files ?? [])
      })
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [])

  /* ── Load file content on selection ─────────────────────────── */

  const selectFile = useCallback((file: DocFileInfo) => {
    setSelectedPath(file.relativePath)
    setSelectedFile(file)
    setMobileShowContent(true)

    // Binary files don't need content fetch
    if (file.fileType === 'pdf' || file.fileType === 'xlsx') {
      setSelectedContent('')
      return
    }

    setContentLoading(true)
    setSelectedContent(null)
    fetch(`/api/docs/${encodeURIComponent(file.relativePath)}`)
      .then((r) => r.json())
      .then((data) => {
        setSelectedContent(data.content ?? '')
      })
      .catch(() => setSelectedContent('Failed to load file content'))
      .finally(() => setContentLoading(false))
  }, [])

  /* ── Filtering ──────────────────────────────────────────────── */

  const filteredFiles = useMemo(() => {
    let filtered = files
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (f) => f.name.toLowerCase().includes(q) || f.relativePath.toLowerCase().includes(q)
      )
    }
    if (typeFilter) {
      filtered = filtered.filter((f) => f.fileType === typeFilter)
    }
    if (categoryFilter) {
      filtered = filtered.filter((f) => f.category === categoryFilter)
    }
    return filtered
  }, [files, search, typeFilter, categoryFilter])

  /* ── Available filter values (only show chips for types that exist) ── */

  const availableTypes = useMemo(() => {
    const types = new Set<DocFileType>()
    for (const f of files) types.add(f.fileType)
    return Array.from(types).sort()
  }, [files])

  const availableCategories = useMemo(() => {
    const cats = new Set<DocCategory>()
    for (const f of files) cats.add(f.category)
    return Array.from(cats).sort()
  }, [files])

  /* ── Export handlers ────────────────────────────────────────── */

  function handleExportPdf() {
    if (!selectedContent || !selectedFile) return
    if (selectedFile.fileType === 'md') {
      exportAsPdf(selectedContent)
    } else {
      // Wrap non-markdown content in code fence for clean PDF
      exportAsPdf('```\n' + selectedContent + '\n```')
    }
  }

  async function handleExportDocx() {
    if (!selectedContent || !selectedFile) return
    if (selectedFile.fileType === 'md') {
      await exportAsDocx(selectedContent)
    } else {
      await exportAsDocx('```\n' + selectedContent + '\n```')
    }
  }

  function handleDownloadRaw() {
    if (!selectedContent || !selectedFile) return
    const blob = new Blob([selectedContent], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, selectedFile.name)
  }

  /* ── Determine if export is available ───────────────────────── */

  const canExport = selectedFile && selectedContent && selectedFile.fileType !== 'pdf' && selectedFile.fileType !== 'xlsx'

  return (
    <div className="flex h-full animate-fade-in" style={{ background: 'var(--bg)' }}>
      {/* ── File list sidebar ─────────────────────────────────── */}
      <aside
        className={`flex-shrink-0 flex flex-col ${mobileShowContent ? 'hidden md:flex' : 'flex'}`}
        style={{
          width: '100%',
          maxWidth: '100%',
          background: 'var(--material-regular)',
          backdropFilter: 'var(--sidebar-backdrop)',
          WebkitBackdropFilter: 'var(--sidebar-backdrop)',
          borderRight: '1px solid var(--separator)',
        }}
      >
        <style>{`@media (min-width: 768px) { aside { width: 320px !important; min-width: 320px !important; } }`}</style>

        {/* Sidebar header */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--separator)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-body)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
            }}
          >
            Documents
          </span>
          <span
            style={{
              fontSize: 'var(--text-caption2)',
              color: 'var(--text-tertiary)',
            }}
          >
            {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Search */}
        <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
                pointerEvents: 'none',
              }}
            />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="apple-input focus-ring"
              aria-label="Search documents"
              style={{
                width: '100%',
                height: 32,
                fontSize: 'var(--text-footnote)',
                padding: '0 var(--space-3) 0 32px',
                borderRadius: 'var(--radius-sm)',
              }}
            />
          </div>
        </div>

        {/* Filter chips */}
        {(availableTypes.length > 1 || availableCategories.length > 1) && (
          <div
            style={{
              padding: '0 var(--space-3) var(--space-2)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
            }}
          >
            {availableTypes.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                className="focus-ring"
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-caption2)',
                  border: '1px solid var(--separator)',
                  background: typeFilter === t ? 'var(--accent)' : 'transparent',
                  color: typeFilter === t ? '#fff' : 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                {FILE_TYPE_LABELS[t]}
              </button>
            ))}
            {availableCategories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
                className="focus-ring"
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-caption2)',
                  border: '1px solid var(--separator)',
                  background: categoryFilter === c ? 'var(--accent)' : 'transparent',
                  color: categoryFilter === c ? '#fff' : 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 120, fontSize: 'var(--text-footnote)', color: 'var(--text-tertiary)' }}
            >
              Loading...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center"
              style={{
                height: 160,
                fontSize: 'var(--text-footnote)',
                color: 'var(--text-tertiary)',
                gap: 'var(--space-2)',
                padding: 'var(--space-4)',
                textAlign: 'center',
              }}
            >
              <FileText size={32} style={{ opacity: 0.3 }} />
              {files.length === 0 ? 'No documents found in workspace' : 'No documents match filters'}
            </div>
          ) : (
            filteredFiles.map((file) => {
              const isActive = selectedPath === file.relativePath
              return (
                <button
                  key={file.relativePath}
                  onClick={() => selectFile(file)}
                  className="w-full text-left hover-bg focus-ring"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    border: 'none',
                    cursor: 'pointer',
                    background: isActive ? 'var(--fill-secondary)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      marginTop: 2,
                      color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                    }}
                  >
                    {fileIcon(file.fileType)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      style={{
                        fontSize: 'var(--text-footnote)',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-primary)',
                        lineHeight: 'var(--leading-snug)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.name}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-caption2)',
                        color: 'var(--text-tertiary)',
                        marginTop: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.relativePath}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        marginTop: 2,
                        fontSize: 'var(--text-caption2)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      <span>{formatDate(file.lastModified)}</span>
                      <span>&middot;</span>
                      <span>{formatSize(file.sizeBytes)}</span>
                      {file.agentId && (
                        <>
                          <span>&middot;</span>
                          <span
                            style={{
                              padding: '0 4px',
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--fill-primary)',
                              fontSize: 'var(--text-caption2)',
                            }}
                          >
                            {file.agentId}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* ── Content view ──────────────────────────────────────── */}
      <main
        className={`flex-1 flex flex-col overflow-hidden ${!mobileShowContent ? 'hidden md:flex' : 'flex'}`}
        style={{ background: 'var(--bg)' }}
      >
        {selectedFile ? (
          <>
            {/* Content header (sticky) */}
            <div
              className="flex-shrink-0"
              style={{
                padding: 'var(--space-3) var(--space-6)',
                borderBottom: '1px solid var(--separator)',
                background: 'var(--material-regular)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              }}
            >
              {/* Mobile back button */}
              <button
                onClick={() => setMobileShowContent(false)}
                className="md:hidden btn-ghost focus-ring"
                aria-label="Back to file list"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-footnote)',
                  color: 'var(--system-blue)',
                  marginBottom: 'var(--space-2)',
                  marginLeft: '-8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <BackArrow />
                Documents
              </button>

              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {fileIcon(selectedFile.fileType)}
                    </span>
                    <div
                      style={{
                        fontSize: 'var(--text-body)',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {selectedFile.name}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-caption1)',
                      color: 'var(--text-tertiary)',
                      marginTop: 2,
                    }}
                  >
                    {selectedFile.relativePath} &middot; {formatSize(selectedFile.sizeBytes)}
                  </div>
                </div>

                {/* Export buttons */}
                {canExport && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {selectedFile.fileType === 'csv' && (
                      <button
                        onClick={handleDownloadRaw}
                        className="btn-ghost focus-ring"
                        title="Download CSV"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 'var(--space-1)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--text-caption1)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--separator)',
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <Download size={12} />
                        CSV
                      </button>
                    )}
                    <button
                      onClick={handleExportPdf}
                      className="btn-ghost focus-ring"
                      title="Export as PDF"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-caption1)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--separator)',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <Printer size={12} />
                      PDF
                    </button>
                    <button
                      onClick={handleExportDocx}
                      className="btn-ghost focus-ring"
                      title="Export as DOCX"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-caption1)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--separator)',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <FileText size={12} />
                      DOCX
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable content area */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ padding: 'var(--space-6) var(--space-10)' }}
            >
              {contentLoading ? (
                <div
                  className="flex items-center justify-center"
                  style={{ height: 200, color: 'var(--text-tertiary)', fontSize: 'var(--text-footnote)' }}
                >
                  Loading...
                </div>
              ) : selectedContent !== null ? (
                <div style={{ maxWidth: 860, margin: '0 auto' }}>
                  <DocViewer file={selectedFile} content={selectedContent} />
                </div>
              ) : null}
            </div>
          </>
        ) : (
          /* Empty state */
          <div
            className="flex-1 flex flex-col items-center justify-center"
            style={{
              color: 'var(--text-tertiary)',
              gap: 'var(--space-3)',
            }}
          >
            <FileText size={48} style={{ opacity: 0.2 }} />
            <div style={{ fontSize: 'var(--text-body)' }}>Select a document to preview</div>
            <div style={{ fontSize: 'var(--text-caption1)' }}>
              Documents generated by your agents appear here
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
