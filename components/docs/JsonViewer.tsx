'use client'

import { useMemo } from 'react'
import { colorizeJson } from '@/lib/sanitize'

interface JsonViewerProps {
  content: string
}

export function JsonViewer({ content }: JsonViewerProps) {
  const formatted = useMemo(() => {
    try {
      const parsed = JSON.parse(content)
      return colorizeJson(JSON.stringify(parsed, null, 2))
    } catch {
      return colorizeJson(content)
    }
  }, [content])

  return (
    <pre
      style={{
        fontFamily: '"SF Mono", Menlo, Consolas, monospace',
        fontSize: 'var(--text-caption1)',
        lineHeight: '1.6',
        color: 'var(--text-primary)',
        background: 'var(--fill-primary)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
  )
}
