'use client'

import { useState } from 'react'
import type { Agent } from '@/lib/types'
import type { ProjectStatus, TicketPriority } from '@/lib/kanban/types'
import { PRIORITY_COLORS } from '@/lib/kanban/types'
import { AgentPicker } from '@/components/kanban/AgentPicker'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface CreateProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: Agent[]
  onSubmit: (project: {
    name: string
    description: string
    status: ProjectStatus
    priority: TicketPriority
    agentId: string | null
  }) => void
}

const STATUSES: { key: ProjectStatus; label: string; color: string }[] = [
  { key: 'planning', label: 'Planning', color: 'var(--system-orange)' },
  { key: 'active', label: 'Active', color: 'var(--system-green)' },
  { key: 'complete', label: 'Complete', color: 'var(--text-tertiary)' },
]

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high']
const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Med',
  high: 'High',
}

const initialState = {
  name: '',
  description: '',
  status: 'planning' as ProjectStatus,
  priority: 'medium' as TicketPriority,
  assigneeId: '' as string,
}

export function CreateProjectModal({
  open,
  onOpenChange,
  agents,
  onSubmit,
}: CreateProjectModalProps) {
  const [form, setForm] = useState(initialState)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit({
      name: form.name.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      agentId: form.assigneeId || null,
    })
    setForm(initialState)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Create a project to group related tickets together.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Name */}
          <div>
            <label
              htmlFor="project-name"
              style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)', fontWeight: 'var(--weight-semibold)', marginBottom: 4, display: 'block' }}
            >
              Name
            </label>
            <input
              id="project-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Smith v. Jones Litigation"
              autoFocus
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--separator)',
                background: 'var(--fill-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-body)',
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="project-desc"
              style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)', fontWeight: 'var(--weight-semibold)', marginBottom: 4, display: 'block' }}
            >
              Description
            </label>
            <textarea
              id="project-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of the project..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--separator)',
                background: 'var(--fill-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-footnote)',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Status */}
          <div>
            <label style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)', fontWeight: 'var(--weight-semibold)', marginBottom: 4, display: 'block' }}>
              Status
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setForm({ ...form, status: s.key })}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    fontSize: 'var(--text-caption1)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: form.status === s.key ? `color-mix(in srgb, ${s.color} 20%, transparent)` : 'var(--fill-tertiary)',
                    color: form.status === s.key ? s.color : 'var(--text-secondary)',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)', fontWeight: 'var(--weight-semibold)', marginBottom: 4, display: 'block' }}>
              Priority
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm({ ...form, priority: p })}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    fontSize: 'var(--text-caption1)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: form.priority === p ? `color-mix(in srgb, ${PRIORITY_COLORS[p]} 20%, transparent)` : 'var(--fill-tertiary)',
                    color: form.priority === p ? PRIORITY_COLORS[p] : 'var(--text-secondary)',
                  }}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Agent lead */}
          <div>
            <label style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)', fontWeight: 'var(--weight-semibold)', marginBottom: 4, display: 'block' }}>
              Lead Agent
            </label>
            <AgentPicker
              agents={agents}
              value={form.assigneeId}
              onChange={(id) => setForm({ ...form, assigneeId: id })}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!form.name.trim()}
            className="btn-primary focus-ring"
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              fontSize: 'var(--text-footnote)',
              fontWeight: 'var(--weight-semibold)',
              cursor: form.name.trim() ? 'pointer' : 'not-allowed',
              opacity: form.name.trim() ? 1 : 0.5,
            }}
          >
            Create Project
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
