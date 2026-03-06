'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LiveLogLine } from '@/lib/types'
import { parseSSEBuffer } from '@/lib/sse'
import { Play, Pause, Copy, Minimize2, X, ChevronRight } from 'lucide-react'

/* ── Constants ────────────────────────────────────────────────── */

const MAX_LINES = 500
const WIDGET_EVENT = 'clawport:open-stream-widget'

const LEVEL_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  info:  { bg: 'rgba(48,209,88,0.12)', color: 'var(--system-green)', label: 'INF' },
  warn:  { bg: 'rgba(255,159,10,0.12)', color: 'var(--system-orange)', label: 'WRN' },
  error: { bg: 'rgba(255,69,58,0.12)',  color: 'var(--system-red)',    label: 'ERR' },
  debug: { bg: 'var(--fill-secondary)', color: 'var(--text-tertiary)', label: 'DBG' },
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts.slice(0, 8)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatCopyLine(line: LiveLogLine): string {
  return `[${formatTime(line.time)}] [${line.level}] ${line.message}`
}

function prettyRaw(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}

/* ── Visual states ────────────────────────────────────────────── */

type WidgetState = 'hidden' | 'collapsed' | 'expanded'

/* ── LogRow ───────────────────────────────────────────────────── */

function LogRow({ line }: { line: LiveLogLine }) {
  const [open, setOpen] = useState(false)
  const lvl = LEVEL_STYLE[line.level] ?? LEVEL_STYLE.debug

  return (
    <div style={{
      borderBottom: '1px solid var(--separator)',
      background: line.level === 'error' ? 'rgba(255,69,58,0.03)' : undefined,
    }}>
      {/* Summary row */}
      <button
        onClick={() => line.raw && setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '5px 12px',
          gap: 8,
          border: 'none',
          background: 'transparent',
          cursor: line.raw ? 'pointer' : 'default',
          textAlign: 'left',
        }}
      >
        {/* Expand chevron */}
        {line.raw ? (
          <ChevronRight size={10} style={{
            color: 'var(--text-tertiary)',
            flexShrink: 0,
            transition: 'transform 150ms var(--ease-smooth)',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }} />
        ) : (
          <span style={{ width: 10, flexShrink: 0 }} />
        )}

        {/* Time */}
        <span className="font-mono" style={{
          color: 'var(--text-tertiary)',
          fontSize: 10,
          flexShrink: 0,
          minWidth: 58,
        }}>
          {formatTime(line.time)}
        </span>

        {/* Level pill */}
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.5px',
          padding: '1px 5px',
          borderRadius: 3,
          background: lvl.bg,
          color: lvl.color,
          flexShrink: 0,
          lineHeight: '14px',
        }}>
          {lvl.label}
        </span>

        {/* Message (truncated) */}
        <span className="font-mono" style={{
          color: line.level === 'error' ? 'var(--system-red)' : 'var(--text-secondary)',
          fontSize: 10,
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}>
          {line.message}
        </span>
      </button>

      {/* Raw JSON detail */}
      {open && line.raw && (
        <div style={{
          padding: '6px 12px 8px 30px',
          borderTop: '1px solid var(--separator)',
          background: 'var(--fill-secondary)',
        }}>
          <pre className="font-mono" style={{
            fontSize: 9,
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
          }}>
            {prettyRaw(line.raw)}
          </pre>
        </div>
      )}
    </div>
  )
}

/* ── Component ────────────────────────────────────────────────── */

export function LiveStreamWidget() {
  const [state, setState] = useState<WidgetState>('hidden')
  const [lines, setLines] = useState<LiveLogLine[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  /* ── Auto-scroll ──────────────────────────────────────────── */

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines, autoScroll])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 40
    if (!atBottom) setAutoScroll(false)
    else setAutoScroll(true)
  }, [])

  /* ── Stream lifecycle ─────────────────────────────────────── */

  const startStream = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStreaming(true)
    setError(null)

    fetch('/api/logs/stream', { signal: controller.signal })
      .then(res => {
        if (!res.ok || !res.body) throw new Error(`Stream failed: HTTP ${res.status}`)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) { setStreaming(false); return }
            buffer += decoder.decode(value, { stream: true })
            const result = parseSSEBuffer(buffer)
            buffer = result.remainder
            if (result.errors.length > 0) setError(result.errors[0])
            if (result.lines.length > 0) {
              setLines(prev => [...prev, ...result.lines].slice(-MAX_LINES))
            }
            return pump()
          })
        }
        return pump()
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Stream connection failed')
        setStreaming(false)
      })
  }, [])

  const stopStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setStreaming(false)
  }, [])

  /* ── Actions ──────────────────────────────────────────────── */

  const handleClose = useCallback(() => {
    stopStream()
    setState('hidden')
  }, [stopStream])

  const handleCopy = useCallback(async () => {
    const text = lines.map(formatCopyLine).join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [lines])

  /* ── DOM event listener ───────────────────────────────────── */

  useEffect(() => {
    function onOpen() {
      setState('expanded')
    }
    window.addEventListener(WIDGET_EVENT, onOpen)
    return () => window.removeEventListener(WIDGET_EVENT, onOpen)
  }, [])

  /* ── Cleanup on unmount ───────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [])

  /* ── Hidden ───────────────────────────────────────────────── */

  if (state === 'hidden') return null

  /* ── Collapsed pill ───────────────────────────────────────── */

  if (state === 'collapsed') {
    return (
      <button
        onClick={() => setState('expanded')}
        className="focus-ring flex items-center"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 50,
          padding: '8px 14px',
          borderRadius: 'var(--radius-pill)',
          border: '1px solid var(--separator)',
          background: 'var(--material-regular)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          cursor: 'pointer',
          gap: 8,
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
        }}
      >
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: streaming ? 'var(--system-green)' : 'var(--text-tertiary)',
          animation: streaming ? 'lsw-pulse 2s ease-in-out infinite' : undefined,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)', fontWeight: 'var(--weight-medium)' }}>
          Live Stream
        </span>
        {lines.length > 0 && (
          <span style={{
            fontSize: 'var(--text-caption2)',
            color: 'var(--text-tertiary)',
            background: 'var(--fill-secondary)',
            padding: '1px 6px',
            borderRadius: 'var(--radius-sm)',
          }}>
            {lines.length}
          </span>
        )}
        <style>{`@keyframes lsw-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      </button>
    )
  }

  /* ── Expanded panel ───────────────────────────────────────── */

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 50,
      width: 440,
      height: 400,
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--separator)',
      background: 'var(--material-regular)',
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center flex-shrink-0" style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--separator)',
        gap: 8,
      }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: streaming ? 'var(--system-green)' : 'var(--text-tertiary)',
          animation: streaming ? 'lsw-pulse 2s ease-in-out infinite' : undefined,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 'var(--text-footnote)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-primary)',
        }}>
          Live Stream
        </span>
        {lines.length > 0 && (
          <span style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-tertiary)' }}>
            {lines.length} line{lines.length !== 1 ? 's' : ''}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button
            onClick={handleCopy}
            className="focus-ring"
            title="Copy all logs"
            disabled={lines.length === 0}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: copied ? 'var(--accent-fill)' : 'transparent',
              color: copied ? 'var(--accent)' : 'var(--text-tertiary)',
              cursor: lines.length === 0 ? 'default' : 'pointer',
              opacity: lines.length === 0 ? 0.3 : 1,
              transition: 'all 150ms var(--ease-smooth)',
            }}
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => setState('collapsed')}
            className="focus-ring"
            title="Minimize"
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              transition: 'color 150ms var(--ease-smooth)',
            }}
          >
            <Minimize2 size={14} />
          </button>
          <button
            onClick={handleClose}
            className="focus-ring"
            title="Close"
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              transition: 'color 150ms var(--ease-smooth)',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '6px 14px',
          background: 'rgba(255,69,58,0.06)',
          borderBottom: '1px solid rgba(255,69,58,0.15)',
          fontSize: 'var(--text-caption2)',
          color: 'var(--system-red)',
          flexShrink: 0,
        }}>
          {error}
        </div>
      )}

      {/* ── Log area ──────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
      >
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{
            height: '100%',
            color: 'var(--text-secondary)',
            gap: 'var(--space-2)',
            padding: 'var(--space-4)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)' }}>
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span style={{ fontSize: 'var(--text-caption1)', fontWeight: 'var(--weight-medium)' }}>
              {streaming ? 'Waiting for log data...' : 'Click Play to start streaming'}
            </span>
          </div>
        ) : (
          <div>
            {lines.map((line, i) => <LogRow key={i} line={line} />)}
          </div>
        )}
      </div>

      {/* ── Footer toolbar ────────────────────────────────────── */}
      <div className="flex items-center flex-shrink-0" style={{
        padding: '8px 14px',
        borderTop: '1px solid var(--separator)',
        gap: 8,
      }}>
        <button
          onClick={streaming ? stopStream : startStream}
          className="focus-ring flex items-center"
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'var(--text-caption1)',
            fontWeight: 'var(--weight-semibold)',
            gap: 5,
            background: streaming ? 'rgba(255,69,58,0.1)' : 'var(--accent-fill)',
            color: streaming ? 'var(--system-red)' : 'var(--accent)',
            transition: 'all 200ms var(--ease-smooth)',
          }}
        >
          {streaming ? <Pause size={12} /> : <Play size={12} />}
          {streaming ? 'Pause' : 'Play'}
        </button>

        {!autoScroll && lines.length > 0 && (
          <button
            onClick={() => setAutoScroll(true)}
            className="focus-ring"
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--text-caption2)',
              fontWeight: 'var(--weight-medium)',
              background: 'var(--fill-secondary)',
              color: 'var(--text-secondary)',
            }}
          >
            Scroll to bottom
          </button>
        )}
      </div>

      <style>{`@keyframes lsw-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
