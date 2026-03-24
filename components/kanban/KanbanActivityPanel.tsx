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
import { AgentAvatar } from '@/components/AgentAvatar'

const MAX_ENTRIES = 100
const PANEL_WIDTH = 320

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
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
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

  const stopStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setStreaming(false)
  }, [])

  // SSE stream lifecycle — connect when open, disconnect when closed
  const startStream = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)
    setError(null)

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

            if (result.errors.length > 0) {
              setError(result.errors[0])
              setStreaming(false)
              stopStream()
              return
            }

            if (result.lines.length > 0) {
              const newEntries = result.lines
                .filter((l: LiveLogLine) => l.type === 'log')
                .map((l: LiveLogLine, i: number) => logLineToEntry(l, agents, logIndexRef.current + i))
                .filter((entry): entry is ActivityEntry => entry !== null)
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
        setError(err instanceof Error ? err.message : 'Live activity stream failed')
        setStreaming(false)
      })
  }, [agents, stopStream])

  useEffect(() => {
    if (isOpen) {
      startStream()
    } else {
      stopStream()
    }
    return () => stopStream()
  }, [isOpen, startStream, stopStream])

  // Relative time ticker — update every 30s
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isOpen || entries.length === 0) return
    const timer = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(timer)
  }, [isOpen, entries.length])

  const displayEntries = [...entries].reverse()

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
        background: 'linear-gradient(180deg, rgba(10,12,16,0.98) 0%, rgba(8,10,14,0.96) 100%)',
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
          background: 'rgba(255,255,255,0.015)',
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
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          minWidth: PANEL_WIDTH,
          padding: 'var(--space-3)',
        }}
      >
        {displayEntries.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-6) var(--space-4)',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 'var(--text-caption1)',
            }}
          >
            {error
              ? error
              : streaming
                ? 'Waiting for activity\u2026'
                : 'No activity yet'}
          </div>
        ) : (
          displayEntries.map((entry) => {
            const agent = entry.agentId
              ? agents.find((candidate) => candidate.id === entry.agentId) ?? null
              : null
            const parent = agent?.reportsTo
              ? agents.find((candidate) => candidate.id === agent.reportsTo) ?? null
              : null
            const isSystem = entry.agentId === null

            return (
            <div
              key={entry.id}
              style={{
                padding: '12px 12px 11px',
                marginBottom: '10px',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.04)',
                background: isSystem
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.015) 100%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.018) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                {agent ? (
                  <AgentAvatar agent={agent} size={28} borderRadius={10} />
                ) : (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    <Activity size={14} />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: entry.agentColor,
                          letterSpacing: '-0.01em',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {entry.agentName}
                      </div>
                      {parent && (
                        <div
                          style={{
                            fontSize: 10,
                            color: 'var(--text-tertiary)',
                            marginTop: '1px',
                          }}
                        >
                          via {parent.name}
                        </div>
                      )}
                    </div>

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

                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: isSystem ? 'var(--text-secondary)' : 'rgba(255,255,255,0.86)',
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {entry.summary}
                  </p>
                </div>
              </div>
            </div>
          )})
        )}
      </div>
    </div>
  )
}
