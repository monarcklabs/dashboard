'use client'

import type { Project } from '@/lib/kanban/types'
import type { Agent } from '@/lib/types'
import { PRIORITY_COLORS } from '@/lib/kanban/types'
import { AgentAvatar } from '@/components/AgentAvatar'

const STATUS_COLORS: Record<string, string> = {
  planning: 'var(--system-orange)',
  active: 'var(--system-green)',
  complete: 'var(--text-tertiary)',
}

const STATUS_LABELS: Record<string, string> = {
  planning: 'Planning',
  active: 'Active',
  complete: 'Complete',
}

interface ProjectCardProps {
  project: Project
  agent: Agent | null
  ticketCount: number
  onClick: () => void
}

export function ProjectCard({ project, agent, ticketCount, onClick }: ProjectCardProps) {
  const statusColor = STATUS_COLORS[project.status] || 'var(--text-tertiary)'

  return (
    <button
      onClick={onClick}
      type="button"
      className="focus-ring"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        background: 'var(--material-regular)',
        border: '1px solid var(--separator)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--separator)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Header: name + status badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <h3 style={{
          fontSize: 'var(--text-body)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--text-primary)',
          margin: 0,
          lineHeight: 1.3,
          flex: 1,
          minWidth: 0,
        }}>
          {project.name}
        </h3>
        <span style={{
          fontSize: 'var(--text-caption2)',
          fontWeight: 'var(--weight-semibold)',
          color: statusColor,
          background: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {STATUS_LABELS[project.status] || project.status}
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p style={{
          fontSize: 'var(--text-caption1)',
          color: 'var(--text-secondary)',
          margin: 0,
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {project.description}
        </p>
      )}

      {/* Footer: agent + priority + ticket count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
          {agent ? (
            <>
              <AgentAvatar agent={agent} size={20} borderRadius={10} />
              <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {agent.name}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
              Unassigned
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          <span style={{
            fontSize: 'var(--text-caption2)',
            color: 'var(--text-tertiary)',
          }}>
            {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}
          </span>
          <span style={{
            fontSize: 'var(--text-caption2)',
            fontWeight: 'var(--weight-semibold)',
            color: PRIORITY_COLORS[project.priority],
            background: `color-mix(in srgb, ${PRIORITY_COLORS[project.priority]} 12%, transparent)`,
            padding: '1px 6px',
            borderRadius: 'var(--radius-sm)',
          }}>
            {project.priority}
          </span>
        </div>
      </div>
    </button>
  )
}
