'use client'

import type { DocFileInfo } from '@/lib/types'
import { MarkdownViewer } from './MarkdownViewer'
import { JsonViewer } from './JsonViewer'
import { CsvViewer } from './CsvViewer'
import { HtmlViewer } from './HtmlViewer'
import { PlainTextViewer } from './PlainTextViewer'
import { BinaryPlaceholder } from './BinaryPlaceholder'

interface DocViewerProps {
  file: DocFileInfo
  content: string
}

export function DocViewer({ file, content }: DocViewerProps) {
  switch (file.fileType) {
    case 'md':
      return <MarkdownViewer content={content} />
    case 'json':
      return <JsonViewer content={content} />
    case 'csv':
      return <CsvViewer content={content} />
    case 'html':
      return <HtmlViewer content={content} />
    case 'txt':
      return <PlainTextViewer content={content} />
    case 'pdf':
    case 'xlsx':
      return <BinaryPlaceholder file={file} />
    default:
      return <PlainTextViewer content={content} />
  }
}
