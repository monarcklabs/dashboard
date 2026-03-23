'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Search, Printer, ClipboardList, Clock } from 'lucide-react'
import type { DocEntry, DocSource } from '@/lib/types'
import { MarkdownViewer } from '@/components/docs/MarkdownViewer'
import { exportAsPdf, exportAsDocx } from '@/lib/export-markdown'

/* ─── Helpers ─────────────────────────────────────────────────── */

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

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function sourceIcon(source: DocSource) {
  return source === 'kanban'
    ? <ClipboardList size={14} />
    : <Clock size={14} />
}

function sourceLabel(source: DocSource) {
  return source === 'kanban' ? 'Ticket' : 'Cron Report'
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
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<DocSource | null>(null)
  const [mobileShowContent, setMobileShowContent] = useState(false)

  /* ── Load documents ─────────────────────────────────────────── */

  useEffect(() => {
    fetch('/api/docs')
      .then((r) => r.json())
      .then((data) => setDocs(data.docs ?? []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [])

  /* ── Selection ──────────────────────────────────────────────── */

  const selectDoc = useCallback((doc: DocEntry) => {
    setSelectedId(doc.id)
    setMobileShowContent(true)
  }, [])

  const selectedDoc = useMemo(() =>
    docs.find(d => d.id === selectedId) ?? null
  , [docs, selectedId])

  /* ── Filtering ──────────────────────────────────────────────── */

  const filteredDocs = useMemo(() => {
    let filtered = docs
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (d) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q)
      )
    }
    if (sourceFilter) {
      filtered = filtered.filter((d) => d.source === sourceFilter)
    }
    return filtered
  }, [docs, search, sourceFilter])

  /* ── Source counts ──────────────────────────────────────────── */

  const kanbanCount = useMemo(() => docs.filter(d => d.source === 'kanban').length, [docs])
  const cronCount = useMemo(() => docs.filter(d => d.source === 'cron').length, [docs])

  /* ── Unique agent tags ─────────────────────────────────────── */

  const agentIds = useMemo(() => {
    const ids = new Set<string>()
    for (const d of docs) {
      if (d.agentId) ids.add(d.agentId)
    }
    return Array.from(ids).sort()
  }, [docs])

  /* ── Export handlers ────────────────────────────────────────── */

  function handleExportPdf() {
    if (!selectedDoc) return
    exportAsPdf(selectedDoc.content)
  }

  async function handleExportDocx() {
    if (!selectedDoc) return
    await exportAsDocx(selectedDoc.content)
  }

  return (
    <div className="flex h-full animate-fade-in" style={{ background: 'var(--bg)' }}>
      {/* ── Document list sidebar ─────────────────────────────── */}
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
        <style>{`@media (min-width: 768px) { aside { width: 340px !important; min-width: 340px !important; } }`}</style>

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
            {filteredDocs.length} doc{filteredDocs.length !== 1 ? 's' : ''}
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

        {/* Source filter chips */}
        <div
          style={{
            padding: '0 var(--space-3) var(--space-2)',
            display: 'flex',
            gap: 4,
          }}
        >
          {kanbanCount > 0 && (
            <button
              onClick={() => setSourceFilter(sourceFilter === 'kanban' ? null : 'kanban')}
              className="focus-ring"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-caption2)',
                border: '1px solid var(--separator)',
                background: sourceFilter === 'kanban' ? 'var(--accent)' : 'transparent',
                color: sourceFilter === 'kanban' ? '#fff' : 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              <ClipboardList size={10} />
              Tickets ({kanbanCount})
            </button>
          )}
          {cronCount > 0 && (
            <button
              onClick={() => setSourceFilter(sourceFilter === 'cron' ? null : 'cron')}
              className="focus-ring"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-caption2)',
                border: '1px solid var(--separator)',
                background: sourceFilter === 'cron' ? 'var(--accent)' : 'transparent',
                color: sourceFilter === 'cron' ? '#fff' : 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              <Clock size={10} />
              Reports ({cronCount})
            </button>
          )}
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 120, fontSize: 'var(--text-footnote)', color: 'var(--text-tertiary)' }}
            >
              Loading...
            </div>
          ) : filteredDocs.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center"
              style={{
                height: 200,
                fontSize: 'var(--text-footnote)',
                color: 'var(--text-tertiary)',
                gap: 'var(--space-2)',
                padding: 'var(--space-4)',
                textAlign: 'center',
              }}
            >
              <FileText size={32} style={{ opacity: 0.3 }} />
              {docs.length === 0
                ? 'No documents yet. Completed ticket work and cron reports will appear here.'
                : 'No documents match your search'}
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const isActive = selectedId === doc.id
              return (
                <button
                  key={doc.id}
                  onClick={() => selectDoc(doc)}
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
                    {sourceIcon(doc.source)}
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
                      {doc.title}
                    </div>
                    {/* Preview snippet */}
                    <div
                      style={{
                        fontSize: 'var(--text-caption2)',
                        color: 'var(--text-tertiary)',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                      }}
                    >
                      {doc.content.replace(/[#*`\n]/g, ' ').slice(0, 80).trim()}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        marginTop: 3,
                        fontSize: 'var(--text-caption2)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      <span>{formatDate(doc.date)}</span>
                      <span>&middot;</span>
                      <span
                        style={{
                          padding: '0 5px',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--fill-primary)',
                        }}
                      >
                        {sourceLabel(doc.source)}
                      </span>
                      {doc.agentId && (
                        <>
                          <span>&middot;</span>
                          <span
                            style={{
                              padding: '0 5px',
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--fill-primary)',
                            }}
                          >
                            {doc.agentId}
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
        {selectedDoc ? (
          <>
            {/* Content header */}
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
                aria-label="Back to document list"
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
                      {sourceIcon(selectedDoc.source)}
                    </span>
                    <div
                      style={{
                        fontSize: 'var(--text-body)',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {selectedDoc.title}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-caption1)',
                      color: 'var(--text-tertiary)',
                      marginTop: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <span>{formatDateTime(selectedDoc.date)}</span>
                    <span>&middot;</span>
                    <span>{sourceLabel(selectedDoc.source)}</span>
                    {selectedDoc.agentId && (
                      <>
                        <span>&middot;</span>
                        <span>Agent: {selectedDoc.agentId}</span>
                      </>
                    )}
                    {selectedDoc.jobId && (
                      <>
                        <span>&middot;</span>
                        <span>Job: {selectedDoc.jobId}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Export buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
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
              </div>
            </div>

            {/* Scrollable content area */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ padding: 'var(--space-6) var(--space-10)' }}
            >
              <div style={{ maxWidth: 760, margin: '0 auto' }}>
                <MarkdownViewer content={selectedDoc.content} />
              </div>
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
              Completed ticket deliverables and cron reports appear here
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
