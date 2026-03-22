'use client'

interface PlainTextViewerProps {
  content: string
}

export function PlainTextViewer({ content }: PlainTextViewerProps) {
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
    >
      {content}
    </pre>
  )
}
