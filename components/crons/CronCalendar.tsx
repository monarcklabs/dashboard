'use client'

import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { Zap } from 'lucide-react'
import type { CronJob, Agent } from '@/lib/types'
import { parseScheduleSlots, isHighFrequency, getFrequencyLabel } from '@/lib/cron-utils'

interface CronCalendarProps {
  crons: CronJob[]
  agents: Agent[]
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Map cron dow (0=Sun) to grid column (0=Sun for this component)
const DOW_TO_COL: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 }

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12
  const ampm = hour < 12 ? 'AM' : 'PM'
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`
}

interface CalendarSlot {
  cron: CronJob
  hour: number
  minute: number
  col: number
  agentColor: string
}

interface TooltipData {
  slot: CalendarSlot
  rect: DOMRect
}

function CardTooltip({ slot, rect, containerRect }: { slot: CalendarSlot; rect: DOMRect; containerRect: DOMRect }) {
  const top = rect.top - containerRect.top - 8
  const left = rect.left - containerRect.left + rect.width / 2

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        transform: 'translate(-50%, -100%)',
        background: 'var(--material-regular)',
        border: '1px solid var(--separator)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        fontSize: 'var(--text-caption1)',
        color: 'var(--text-primary)',
        pointerEvents: 'none',
        zIndex: 100,
        minWidth: 220,
        maxWidth: 320,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: -5,
          left: '50%',
          transform: 'translateX(-50%) rotate(45deg)',
          width: 10,
          height: 10,
          background: 'var(--material-regular)',
          borderRight: '1px solid var(--separator)',
          borderBottom: '1px solid var(--separator)',
        }}
      />
      <div style={{
        fontWeight: 'var(--weight-bold)',
        fontSize: 'var(--text-footnote)',
        marginBottom: 'var(--space-1)',
        borderLeft: `3px solid ${slot.agentColor}`,
        paddingLeft: 'var(--space-2)',
      }}>
        {slot.cron.name}
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-caption1)', marginBottom: 'var(--space-2)' }}>
        {slot.cron.scheduleDescription || slot.cron.schedule}
        {slot.cron.timezone && (
          <span style={{ color: 'var(--text-tertiary)', marginLeft: 'var(--space-1)' }}>
            ({slot.cron.timezone})
          </span>
        )}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption2)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}>
        {slot.cron.schedule}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--text-caption1)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <span
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: slot.cron.status === 'ok' ? 'var(--system-green)' : slot.cron.status === 'error' ? 'var(--system-red)' : 'var(--text-tertiary)',
              flexShrink: 0,
            }}
          />
          <span style={{
            color: slot.cron.status === 'ok' ? 'var(--system-green)' : slot.cron.status === 'error' ? 'var(--system-red)' : 'var(--text-tertiary)',
            fontWeight: 'var(--weight-medium)',
            textTransform: 'capitalize',
          }}>
            {slot.cron.status}
          </span>
        </span>
        {slot.cron.nextRun && (
          <span style={{ color: 'var(--text-tertiary)' }}>
            Next: {new Date(slot.cron.nextRun).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>
      {slot.cron.lastError && (
        <div style={{
          marginTop: 'var(--space-2)',
          padding: 'var(--space-1) var(--space-2)',
          background: 'rgba(255,69,58,0.08)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--text-caption2)',
          color: 'var(--system-red)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {slot.cron.lastError}
        </div>
      )}
    </div>
  )
}

export function CronCalendar({ crons, agents }: CronCalendarProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)

  const agentColorMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const agent of agents) {
      map.set(agent.id, agent.color)
    }
    return map
  }, [agents])

  const getColor = useCallback((agentId: string | null) => {
    if (!agentId) return 'var(--text-secondary)'
    return agentColorMap.get(agentId) || 'var(--text-secondary)'
  }, [agentColorMap])

  const updateContainerRect = useCallback(() => {
    if (containerRef.current) {
      setContainerRect(containerRef.current.getBoundingClientRect())
    }
  }, [])

  useEffect(() => {
    updateContainerRect()
    window.addEventListener('resize', updateContainerRect, { passive: true })
    return () => window.removeEventListener('resize', updateContainerRect)
  }, [updateContainerRect])

  // Separate high-frequency ("Always Running") from calendar jobs
  const { alwaysRunning, calendarSlots } = useMemo(() => {
    const alwaysRunning: { cron: CronJob; label: string; color: string }[] = []
    const slotsByCol = new Map<number, CalendarSlot[]>()

    for (let i = 0; i < 7; i++) slotsByCol.set(i, [])

    for (const cron of crons) {
      if (!cron.enabled) continue

      if (isHighFrequency(cron.schedule)) {
        alwaysRunning.push({
          cron,
          label: getFrequencyLabel(cron.schedule),
          color: getColor(cron.agentId),
        })
        continue
      }

      const parsed = parseScheduleSlots(cron.schedule)
      if (!parsed) continue

      for (const dow of parsed.days) {
        const col = DOW_TO_COL[dow]
        if (col === undefined) continue
        const slots = slotsByCol.get(col) || []
        slots.push({
          cron,
          hour: parsed.hour,
          minute: parsed.minute,
          col,
          agentColor: getColor(cron.agentId),
        })
        slotsByCol.set(col, slots)
      }
    }

    // Sort each column by time
    for (const [col, slots] of slotsByCol) {
      slotsByCol.set(col, slots.sort((a, b) => a.hour - b.hour || a.minute - b.minute || a.cron.name.localeCompare(b.cron.name)))
    }

    return { alwaysRunning, calendarSlots: slotsByCol }
  }, [crons, getColor])

  const now = new Date()
  const todayDow = now.getDay() // 0=Sun

  function handleCardEnter(slot: CalendarSlot, e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    updateContainerRect()
    setTooltip({ slot, rect })
  }

  useEffect(() => {
    if (!tooltip) return
    const handler = () => setTooltip(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [tooltip])

  const enabledCount = crons.filter((c) => c.enabled).length

  if (enabledCount === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ height: 200, color: 'var(--text-secondary)', gap: 'var(--space-2)' }}
      >
        <svg
          width="32" height="32" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-medium)' }}>
          No scheduled jobs to display
        </span>
        <span style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-tertiary)' }}>
          Enable some cron jobs to see the calendar
        </span>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="animate-fade-in"
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}
      onClick={() => setTooltip(null)}
    >
      {/* Always Running section */}
      {alwaysRunning.length > 0 && (
        <div style={{ flexShrink: 0, marginBottom: 'var(--space-4)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
          }}>
            <Zap size={14} style={{ color: 'var(--text-tertiary)' }} />
            <span style={{
              fontSize: 'var(--text-footnote)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-secondary)',
            }}>
              Always Running
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {alwaysRunning.map((item) => (
              <div
                key={item.cron.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: `color-mix(in srgb, ${item.color} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${item.color} 20%, transparent)`,
                  fontSize: 'var(--text-caption1)',
                }}
              >
                <span style={{
                  fontWeight: 'var(--weight-semibold)',
                  color: item.color,
                }}>
                  {item.cron.name}
                </span>
                <span style={{
                  color: 'var(--text-tertiary)',
                  fontSize: 'var(--text-caption2)',
                }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly calendar grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 0,
        background: 'var(--material-regular)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--separator)',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {DAY_LABELS.map((label, col) => {
          const isToday = col === todayDow
          const slots = calendarSlots.get(col) || []

          return (
            <div
              key={label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                borderLeft: col > 0 ? '1px solid var(--separator)' : 'none',
                minWidth: 0,
              }}
            >
              {/* Day header */}
              <div
                style={{
                  padding: 'var(--space-3) var(--space-2)',
                  textAlign: 'center',
                  borderBottom: '1px solid var(--separator)',
                  background: isToday ? 'var(--accent-fill)' : 'var(--material-thick)',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--text-footnote)',
                    fontWeight: isToday ? 'var(--weight-bold)' : 'var(--weight-semibold)',
                    color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {label}
                </span>
              </div>

              {/* Job cards */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 'var(--space-2) var(--space-1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1)',
                  background: isToday ? 'color-mix(in srgb, var(--accent) 3%, transparent)' : undefined,
                }}
              >
                {slots.map((slot, idx) => {
                  const isActive = tooltip?.slot.cron.id === slot.cron.id && tooltip?.slot.col === slot.col
                  const isError = slot.cron.status === 'error'

                  return (
                    <button
                      key={`${slot.cron.id}-${col}-${idx}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const r = e.currentTarget.getBoundingClientRect()
                        updateContainerRect()
                        setTooltip(isActive ? null : { slot, rect: r })
                      }}
                      onMouseEnter={(e) => handleCardEnter(slot, e)}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        cursor: 'pointer',
                        width: '100%',
                        minWidth: 0,
                        background: isActive
                          ? `color-mix(in srgb, ${slot.agentColor} 25%, transparent)`
                          : `color-mix(in srgb, ${slot.agentColor} 10%, transparent)`,
                        borderLeft: `3px solid ${slot.agentColor}`,
                        transition: 'background 150ms ease',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 'var(--text-caption1)',
                          fontWeight: 'var(--weight-semibold)',
                          color: slot.agentColor,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.3,
                        }}
                      >
                        {slot.cron.name}
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--text-caption2)',
                          color: isError ? 'var(--system-red)' : 'var(--text-tertiary)',
                          lineHeight: 1.2,
                        }}
                      >
                        {formatTime(slot.hour, slot.minute)}
                      </span>
                    </button>
                  )
                })}

                {slots.length === 0 && (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--text-caption2)',
                    color: 'var(--text-tertiary)',
                    opacity: 0.5,
                    minHeight: 60,
                  }}>
                    —
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tooltip */}
      {tooltip && containerRect && (
        <CardTooltip
          slot={tooltip.slot}
          rect={tooltip.rect}
          containerRect={containerRect}
        />
      )}
    </div>
  )
}
