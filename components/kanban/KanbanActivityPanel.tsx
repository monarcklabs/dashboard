'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, X } from 'lucide-react'
import type { Agent, LiveLogLine } from '@/lib/types'
import type { KanbanStore } from '@/lib/kanban/store'
import { parseSSEBuffer } from '@/lib/sse'
import {
  type ActivityEntry,
  logLineToEntry,
  diffTicketEvents,
  formatRelativeTime,
} from '@/lib/kanban/activity-feed'

const MAX_ENTRIES = 100
const PANEL_WIDTH = 300

interface KanbanActivityPanelProps {
  isOpen: boolean
  onClose: () => void
  agents: Agent[]
  tickets: KanbanStore
}

export function KanbanActivityPanel({
  isOpen,
  onClose,
  agents,
  tickets,
}: KanbanActivityPanelProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const prevTicketsRef = useRef<KanbanStore>(tickets)
  const logIndexRef = useRef(0)

  // Track ticket changes and generate activity entries
  useEffect(() => {
    const prev = prevTicketsRef.current
    prevTicketsRef.current = tickets

    // Skip the initial mount
    if (prev === tickets) return

    const events = diffTicketEvents(prev, tickets, agents)
    if (events.length > 0) {
      setEntries((prev) => [...prev, ...events].slice(-MAX_ENTRIES))
    }
  }, [tickets, agents])

  // SSE stream lifecycle — connect when open, disconnect when closed
  const startStream = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)

    fetch('/api/logs/stream', { signal: controller.signal })
      .then((res) => {
        if (!res.ok || !res.body) throw new Error(`Stream failed: HTTP ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) {
              setStreaming(false)
              return
            }
            buffer += decoder.decode(value, { stream: true })
            const result = parseSSEBuffer(buffer)
            buffer = result.remainder

            if (result.lines.length > 0) {
              const newEntries = result.lines
                .filter((l: LiveLogLine) => l.type === 'log')
                .map((l: LiveLogLine, i: number) => {
                  const entry = logLineToEntry(l, agents, logIndexRef.current + i)
                  return entry
                })
              logIndexRef.current += result.lines.length

              if (newEntries.length > 0) {
                setEntries((prev) => [...prev, ...newEntries].slice(-MAX_ENTRIES))
              }
            }
            return pump()
          })
        }
        return pump()
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setStreaming(false)
      })
  }, [agents])

  const stopStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setStreaming(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      startStream()
    } else {
      stopStream()
    }
    return () => stopStream()
  }, [isOpen, startStream, stopStream])

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40
  }, [])

  // Relative time ticker — update every 30s
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isOpen || entries.length === 0) return
    const timer = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(timer)
  }, [isOpen, entries.length])

  return (
    <div
      style={{
        width: isOpen ? PANEL_WIDTH : 0,
        minWidth: isOpen ? PANEL_WIDTH : 0,
        overflow: 'hidden',
        transition: 'width 250ms ease, min-width 250ms ease',
        borderLeft: isOpen ? '1px solid var(--separator)' : 'none',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--separator)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          minWidth: PANEL_WIDTH,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Activity size={14} style={{ color: 'var(--text-secondary)' }} />
          <span
            style={{
              fontSize: 'var(--text-footnote)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
            }}
          >
            Live Activity
          </span>
          {streaming && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#10b981',
                display: 'inline-block',
                animation: 'pulse 2s infinite',
              }}
            />
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          minWidth: PANEL_WIDTH,
        }}
      >
        {entries.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-6) var(--space-4)',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--text-caption1)',
            }}
          >
            {streaming ? 'Waiting for activity\u2026' : 'No activity yet'}
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: '1px solid var(--separator)',
              }}
            >
              {/* Agent name + time */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: entry.agentColor,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: entry.agentColor,
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {entry.agentName}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatRelativeTime(entry.timestamp)}
                </span>
              </div>
              {/* Summary */}
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  paddingLeft: 16,
                }}
              >
                {entry.summary}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
