'use client'

import { useMemo } from 'react'
import { parseCsv } from '@/lib/csv-parse'

interface CsvViewerProps {
  content: string
}

export function CsvViewer({ content }: CsvViewerProps) {
  const { headers, rows } = useMemo(() => parseCsv(content), [content])

  if (headers.length === 0) {
    return (
      <div style={{ color: 'var(--text-tertiary)', padding: 'var(--space-6)' }}>
        Empty CSV file
      </div>
    )
  }

  return (
    <div style={{ overflow: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--separator)' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--text-caption1)',
          fontFamily: '"SF Mono", Menlo, Consolas, monospace',
        }}
      >
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  position: 'sticky',
                  top: 0,
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--fill-secondary)',
                  color: 'var(--text-primary)',
                  fontWeight: 'var(--weight-semibold)' as string,
                  textAlign: 'left',
                  borderBottom: '1px solid var(--separator)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: 'var(--space-1) var(--space-3)',
                    color: 'var(--text-secondary)',
                    borderBottom: '1px solid var(--separator)',
                    whiteSpace: 'nowrap',
                    maxWidth: 300,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
