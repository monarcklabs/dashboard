'use client'

import { useMemo } from 'react'
import { renderMarkdown } from '@/lib/sanitize'

interface MarkdownViewerProps {
  content: string
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  const html = useMemo(() => renderMarkdown(content), [content])

  return (
    <div
      className="doc-markdown-viewer"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        fontSize: 'var(--text-body)',
        lineHeight: '1.7',
        color: 'var(--text-primary)',
        maxWidth: 760,
      }}
    />
  )
}
