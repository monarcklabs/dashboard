'use client'

import type { DocFileInfo } from '@/lib/types'
import { FileText, Download } from 'lucide-react'

interface BinaryPlaceholderProps {
  file: DocFileInfo
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BinaryPlaceholder({ file }: BinaryPlaceholderProps) {
  function handleDownload() {
    const url = `/api/docs/${encodeURIComponent(file.relativePath)}`
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-10)',
        color: 'var(--text-secondary)',
      }}
    >
      <FileText size={48} style={{ color: 'var(--text-tertiary)' }} />
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 'var(--text-body)',
            fontWeight: 'var(--weight-semibold)' as string,
            color: 'var(--text-primary)',
          }}
        >
          {file.name}
        </div>
        <div style={{ fontSize: 'var(--text-caption1)', marginTop: 'var(--space-1)' }}>
          {file.fileType.toUpperCase()} file &middot; {formatSize(file.sizeBytes)}
        </div>
        <div
          style={{
            fontSize: 'var(--text-caption2)',
            color: 'var(--text-tertiary)',
            marginTop: 'var(--space-1)',
          }}
        >
          Binary files cannot be previewed in the browser
        </div>
      </div>
      <button
        onClick={handleDownload}
        className="btn-ghost focus-ring"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-4)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--text-footnote)',
          color: 'var(--system-blue)',
          border: '1px solid var(--separator)',
          cursor: 'pointer',
          background: 'transparent',
        }}
      >
        <Download size={14} />
        Download
      </button>
    </div>
  )
}
