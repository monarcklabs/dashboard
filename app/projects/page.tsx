'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useAgentsContext } from '@/app/agents-provider'
import type { Project } from '@/lib/kanban/types'
import {
  loadProjects,
  saveProjects,
  createProject,
  mergeProjectStores,
  type ProjectStore,
} from '@/lib/kanban/projects-store'
import { loadTickets, type KanbanStore } from '@/lib/kanban/store'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { CreateProjectModal } from '@/components/projects/CreateProjectModal'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectStore>({})
  const [tickets, setTickets] = useState<KanbanStore>({})
  const { agents, error: agentsError } = useAgentsContext()
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const router = useRouter()

  const persistProjects = useCallback(
    (updater: ProjectStore | ((prev: ProjectStore) => ProjectStore)) => {
      setProjects((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        saveProjects(next)
        return next
      })
    },
    [],
  )

  const loadData = useCallback(() => {
    setLoading(true)

    const localProjects = loadProjects()
    const localTickets = loadTickets()
    setTickets(localTickets)

    fetch('/api/kanban/projects')
      .then((r) => (r.ok ? r.json() : ({} as ProjectStore)))
      .catch(() => ({} as ProjectStore))
      .then((remote: ProjectStore) => {
        const merged = mergeProjectStores(remote, localProjects)
        persistProjects(merged)

        if (JSON.stringify(merged) !== JSON.stringify(remote) && Object.keys(localProjects).length > 0) {
          fetch('/api/kanban/projects', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged),
          }).catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [persistProjects])

  useEffect(() => { loadData() }, [loadData])

  // Sync to server on changes
  useEffect(() => {
    if (!loading) {
      fetch('/api/kanban/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projects),
      }).catch(() => {})
    }
  }, [projects, loading])

  function handleCreateProject(data: {
    name: string
    description: string
    status: Project['status']
    priority: Project['priority']
    agentId: string | null
  }) {
    persistProjects((prev) => createProject(prev, data))
  }

  function getTicketCount(projectId: string): number {
    return Object.values(tickets).filter((t) => t.projectId === projectId).length
  }

  if (agentsError) {
    return <ErrorState message={agentsError} onRetry={loadData} />
  }

  const projectList = Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt)
  const activeCount = projectList.filter((p) => p.status === 'active').length
  const planningCount = projectList.filter((p) => p.status === 'planning').length

  return (
    <div style={{ padding: 'var(--space-5)', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-5)',
      }}>
        <div>
          <h1 style={{
            fontSize: 'var(--text-title2)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '-0.3px',
          }}>
            Projects
          </h1>
          <p style={{
            fontSize: 'var(--text-caption1)',
            color: 'var(--text-tertiary)',
            margin: '2px 0 0',
          }}>
            {projectList.length} total
            {activeCount > 0 && ` \u00b7 ${activeCount} active`}
            {planningCount > 0 && ` \u00b7 ${planningCount} planning`}
          </p>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="btn-primary focus-ring btn-scale"
          style={{
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            fontSize: 'var(--text-footnote)',
            fontWeight: 'var(--weight-semibold)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <Plus size={16} />
          New Project
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      ) : projectList.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center"
          style={{
            height: 300,
            color: 'var(--text-secondary)',
            gap: 'var(--space-3)',
          }}
        >
          <svg
            width="40" height="40" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          </svg>
          <span style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-medium)' }}>
            No projects yet
          </span>
          <span style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-tertiary)' }}>
            Create a project to group related tickets together
          </span>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          {projectList.map((project) => {
            const agent = project.agentId
              ? agents.find((a) => a.id === project.agentId) ?? null
              : null

            return (
              <ProjectCard
                key={project.id}
                project={project}
                agent={agent}
                ticketCount={getTicketCount(project.id)}
                onClick={() => router.push(`/kanban?project=${project.id}`)}
              />
            )
          })}
        </div>
      )}

      <CreateProjectModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        agents={agents}
        onSubmit={handleCreateProject}
      />
    </div>
  )
}
