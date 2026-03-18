'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { RelevantFile } from '@/lib/kanban/types'

interface DriveFilePickerProps {
  value: RelevantFile[]
  onChange: (files: RelevantFile[]) => void
}

interface DriveSearchResult {
  id: string
  name: string
  mimeType: string
  url: string
  iconLink: string
}

interface DriveBrowseItem {
  id: string
  name: string
  mimeType: string
  isFolder: boolean
  url: string | null
}

interface FolderCrumb {
  id: string
  name: string
}

const MIME_ICONS: Record<string, string> = {
  'application/vnd.google-apps.document': '\u{1F4DD}',   // memo (Docs)
  'application/vnd.google-apps.spreadsheet': '\u{1F4CA}', // bar chart (Sheets)
  'application/vnd.google-apps.presentation': '\u{1F4CA}', // bar chart (Slides)
  'application/pdf': '\u{1F4C4}',                          // page facing up
  'application/vnd.google-apps.folder': '\u{1F4C1}',       // folder
}

function fileIcon(mimeType: string): string {
  return MIME_ICONS[mimeType] ?? '\u{1F4CE}' // paperclip default
}

export function DriveFilePicker({ value, onChange }: DriveFilePickerProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'search' | 'browse'>('search')

  // Search state
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<DriveSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)

  // Browse state
  const [folderStack, setFolderStack] = useState<FolderCrumb[]>([{ id: 'root', name: 'My Drive' }])
  const [browseItems, setBrowseItems] = useState<DriveBrowseItem[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [browseHighlightIdx, setBrowseHighlightIdx] = useState(0)
  const [browseRetry, setBrowseRetry] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedIds = new Set(value.map((f) => f.id))
  const currentFolder = folderStack[folderStack.length - 1]

  // Debounced search
  useEffect(() => {
    if (!open || tab !== 'search') return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search.trim()) params.set('q', search.trim())
        const res = await fetch(`/api/drive/files?${params}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.files ?? [])
        }
      } catch {
        // Silently fail - results stay empty
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, open, tab])

  // Browse fetch
  useEffect(() => {
    if (!open || tab !== 'browse') return

    setBrowseLoading(true)
    setBrowseError(null)
    setBrowseItems([])

    const controller = new AbortController()

    fetch(`/api/drive/folder?id=${currentFolder.id}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setBrowseItems(data.items ?? [])
        setBrowseHighlightIdx(0)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setBrowseError('Could not load folder contents')
        }
      })
      .finally(() => setBrowseLoading(false))

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, currentFolder.id, browseRetry])

  // Focus search when opening in search tab
  useEffect(() => {
    if (open && tab === 'search') {
      setTimeout(() => searchRef.current?.focus(), 0)
    }
    if (!open) {
      setSearch('')
      setResults([])
      setTab('search')
      setFolderStack([{ id: 'root', name: 'My Drive' }])
      setBrowseItems([])
      setBrowseError(null)
    }
  }, [open, tab])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const items = listRef.current.querySelectorAll('[data-file-option]')
    const idx = tab === 'search' ? highlightIdx : browseHighlightIdx
    const item = items[idx]
    if (item) item.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx, browseHighlightIdx, open, tab])

  // Reset search highlight when results change
  useEffect(() => {
    setHighlightIdx(0)
  }, [results])

  function toggleFile(file: { id: string; name: string; mimeType: string; url: string | null }) {
    if (!file.url) return
    if (selectedIds.has(file.id)) {
      onChange(value.filter((f) => f.id !== file.id))
    } else {
      onChange([...value, { id: file.id, name: file.name, mimeType: file.mimeType, url: file.url }])
    }
  }

  function removeFile(fileId: string) {
    onChange(value.filter((f) => f.id !== fileId))
  }

  function navigateInto(item: DriveBrowseItem) {
    setFolderStack((stack) => [...stack, { id: item.id, name: item.name }])
  }

  function navigateToCrumb(index: number) {
    setFolderStack((stack) => stack.slice(0, index + 1))
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault()
          setOpen(true)
        }
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }

      if (tab === 'search') {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setHighlightIdx((i) => Math.min(i + 1, results.length - 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setHighlightIdx((i) => Math.max(i - 1, 0))
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (results[highlightIdx]) {
            toggleFile(results[highlightIdx])
          }
        }
      } else {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setBrowseHighlightIdx((i) => Math.min(i + 1, browseItems.length - 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setBrowseHighlightIdx((i) => Math.max(i - 1, 0))
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const item = browseItems[browseHighlightIdx]
          if (!item) return
          if (item.isFolder) {
            navigateInto(item)
          } else {
            toggleFile(item)
          }
        } else if (e.key === 'Backspace' && folderStack.length > 1) {
          e.preventDefault()
          setFolderStack((stack) => stack.slice(0, -1))
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, tab, highlightIdx, results, browseHighlightIdx, browseItems, folderStack, value],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <label
        style={{
          fontSize: 'var(--text-caption1)',
          fontWeight: 'var(--weight-medium)',
          color: 'var(--text-secondary)',
        }}
      >
        Relevant Files
      </label>
      <div ref={containerRef} style={{ position: 'relative' }} onKeyDown={handleKeyDown}>
        {/* Trigger button */}
        <button
          type="button"
          className="apple-input focus-ring"
          onClick={() => setOpen(!open)}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '8px 12px',
            fontSize: 'var(--text-body)',
            color: value.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            textAlign: 'left',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            paddingRight: 36,
            minHeight: 40,
          }}
        >
          {value.length > 0 ? (
            <span>
              {value.length} file{value.length !== 1 ? 's' : ''} attached
            </span>
          ) : (
            <span>Attach files from Drive</span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              zIndex: 50,
              background: 'var(--material-regular)',
              border: '1px solid var(--separator)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}
          >
            {/* Tab bar */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--separator)',
              }}
            >
              {(['search', 'browse'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    fontSize: 'var(--text-footnote)',
                    fontWeight: tab === t ? 'var(--weight-semibold)' : 'var(--weight-regular)',
                    color: tab === t ? 'var(--accent)' : 'var(--text-tertiary)',
                    background: 'none',
                    border: 'none',
                    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    marginBottom: -1,
                  }}
                >
                  {t === 'search' ? 'Search' : 'Browse'}
                </button>
              ))}
            </div>

            {/* Search tab */}
            {tab === 'search' && (
              <>
                <div style={{ padding: '8px 8px 4px' }}>
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search Drive files..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="focus-ring"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: 'var(--text-footnote)',
                      border: '1px solid var(--separator)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--fill-tertiary)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div
                  ref={listRef}
                  role="listbox"
                  aria-multiselectable="true"
                  style={{ maxHeight: 280, overflowY: 'auto', padding: '4px' }}
                >
                  {loading && (
                    <div style={emptyStyle}>Searching...</div>
                  )}

                  {!loading &&
                    results.map((file, i) => {
                      const isHighlighted = highlightIdx === i
                      const isSelected = selectedIds.has(file.id)

                      return (
                        <div
                          key={file.id}
                          data-file-option
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => toggleFile(file)}
                          onMouseEnter={() => setHighlightIdx(i)}
                          style={rowStyle(isHighlighted)}
                        >
                          <span style={{ fontSize: 16, flexShrink: 0 }}>{fileIcon(file.mimeType)}</span>
                          <span style={nameStyle}>{file.name}</span>
                          {isSelected && <span style={{ color: 'var(--accent)', fontSize: 13, flexShrink: 0 }}>&#10003;</span>}
                        </div>
                      )
                    })}

                  {!loading && results.length === 0 && (
                    <div style={emptyStyle}>
                      {search.trim() ? `No files match "${search}"` : 'Type to search Drive files'}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Browse tab */}
            {tab === 'browse' && (
              <>
                {/* Breadcrumb */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'nowrap',
                    overflow: 'hidden',
                    padding: '6px 10px',
                    borderBottom: '1px solid var(--separator)',
                    gap: 2,
                  }}
                >
                  {folderStack.map((crumb, i) => {
                    const isLast = i === folderStack.length - 1
                    return (
                      <span key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                        {i > 0 && (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: 10, flexShrink: 0, padding: '0 2px' }}>›</span>
                        )}
                        <button
                          type="button"
                          onClick={() => !isLast && navigateToCrumb(i)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontSize: 'var(--text-caption1)',
                            color: isLast ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            cursor: isLast ? 'default' : 'pointer',
                            fontWeight: isLast ? 'var(--weight-medium)' : 'var(--weight-regular)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 120,
                          }}
                        >
                          {crumb.name}
                        </button>
                      </span>
                    )
                  })}
                </div>

                {/* Folder contents */}
                <div
                  ref={listRef}
                  role="listbox"
                  aria-multiselectable="true"
                  style={{ maxHeight: 280, overflowY: 'auto', padding: '4px' }}
                >
                  {browseLoading && <div style={emptyStyle}>Loading...</div>}

                  {!browseLoading && browseError && (
                    <div style={{ ...emptyStyle, color: 'var(--system-red, #ff453a)' }}>
                      {browseError}{' '}
                      <button
                        type="button"
                        onClick={() => setBrowseRetry((n) => n + 1)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--accent)',
                          fontSize: 'inherit',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!browseLoading && !browseError && browseItems.length === 0 && (
                    <div style={emptyStyle}>This folder is empty</div>
                  )}

                  {!browseLoading && !browseError &&
                    browseItems.map((item, i) => {
                      const isHighlighted = browseHighlightIdx === i
                      const isSelected = !item.isFolder && selectedIds.has(item.id)

                      return (
                        <div
                          key={item.id}
                          data-file-option
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            if (item.isFolder) {
                              navigateInto(item)
                            } else {
                              toggleFile(item)
                            }
                          }}
                          onMouseEnter={() => setBrowseHighlightIdx(i)}
                          style={rowStyle(isHighlighted)}
                        >
                          <span style={{ fontSize: 16, flexShrink: 0 }}>{fileIcon(item.mimeType)}</span>
                          <span style={nameStyle}>{item.name}</span>
                          {item.isFolder && (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 11, flexShrink: 0, marginLeft: 'auto' }}>›</span>
                          )}
                          {!item.isFolder && isSelected && (
                            <span style={{ color: 'var(--accent)', fontSize: 13, flexShrink: 0 }}>&#10003;</span>
                          )}
                        </div>
                      )
                    })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Selected files chips */}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 2 }}>
          {value.map((file) => (
            <span
              key={file.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--fill-tertiary)',
                fontSize: 'var(--text-caption2)',
                color: 'var(--text-secondary)',
                maxWidth: 200,
              }}
            >
              <span style={{ fontSize: 12 }}>{fileIcon(file.mimeType)}</span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                  marginLeft: 2,
                  flexShrink: 0,
                }}
                aria-label={`Remove ${file.name}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Shared style helpers
function rowStyle(isHighlighted: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    background: isHighlighted ? 'var(--fill-secondary)' : 'transparent',
    transition: 'background 100ms',
  }
}

const nameStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 'var(--text-footnote)',
  fontWeight: 'var(--weight-medium)',
  color: 'var(--text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const emptyStyle: React.CSSProperties = {
  padding: 'var(--space-4)',
  textAlign: 'center',
  fontSize: 'var(--text-footnote)',
  color: 'var(--text-tertiary)',
}
