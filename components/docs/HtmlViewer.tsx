'use client'

interface HtmlViewerProps {
  content: string
}

export function HtmlViewer({ content }: HtmlViewerProps) {
  return (
    <iframe
      srcDoc={content}
      sandbox=""
      style={{
        width: '100%',
        height: '100%',
        minHeight: 500,
        border: '1px solid var(--separator)',
        borderRadius: 'var(--radius-md)',
        background: '#fff',
      }}
      title="HTML Preview"
    />
  )
}
