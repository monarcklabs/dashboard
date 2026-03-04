import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import bundledRegistry from '@/lib/agents.json'
import type { Agent } from '@/lib/types'

/** Raw agent data from JSON (everything except runtime-loaded soul and crons) */
export type AgentEntry = Omit<Agent, 'soul' | 'crons'>

/** Color palette assigned to auto-discovered agents */
const DISCOVER_COLORS = [
  '#f5c518', '#a855f7', '#3b82f6', '#22c55e', '#f97316',
  '#eab308', '#14b8a6', '#60a5fa', '#f59e0b', '#94a3b8',
  '#06b6d4', '#ec4899', '#84cc16', '#8b5cf6', '#ef4444',
]

/**
 * Extract a display name from SOUL.md content.
 * Returns the text of the first `# Heading` line, or null.
 */
function extractNameFromSoul(content: string): string | null {
  const match = content.match(/^#\s+(.+)/m)
  return match ? match[1].trim() : null
}

/**
 * Convert a directory slug to a display name: "my-agent" -> "My Agent"
 */
function slugToName(slug: string): string {
  return slug
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Auto-discover agents from $WORKSPACE_PATH.
 *
 * Scans the workspace for a root SOUL.md and agent subdirectories
 * under agents/. Each subdirectory with a SOUL.md becomes an agent.
 * Returns null if nothing can be discovered.
 */
function discoverAgents(workspacePath: string): AgentEntry[] | null {
  const agentsDir = join(workspacePath, 'agents')
  const rootSoulPath = join(workspacePath, 'SOUL.md')
  const hasRoot = existsSync(rootSoulPath)

  // Scan agents/ directory for subdirectories with SOUL.md
  let agentDirs: string[] = []
  if (existsSync(agentsDir)) {
    try {
      const entries = readdirSync(agentsDir, { withFileTypes: true })
      agentDirs = entries
        .filter(e => e.isDirectory() && existsSync(join(agentsDir, e.name, 'SOUL.md')))
        .map(e => e.name)
    } catch {
      // Can't read directory
    }
  }

  // Need at least a root or one agent to return a discovered registry
  if (!hasRoot && agentDirs.length === 0) return null

  const discovered: AgentEntry[] = []

  // Build root agent from workspace SOUL.md
  let rootId = 'main'
  let rootName = 'Main'
  if (hasRoot) {
    try {
      const content = readFileSync(rootSoulPath, 'utf-8')
      const extracted = extractNameFromSoul(content)
      if (extracted) {
        rootName = extracted
        rootId = extracted.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'main'
      }
    } catch {}

    discovered.push({
      id: rootId,
      name: rootName,
      title: 'Orchestrator',
      reportsTo: null,
      directReports: agentDirs,
      soulPath: 'SOUL.md',
      voiceId: null,
      color: DISCOVER_COLORS[0],
      emoji: '\u{1F916}',
      tools: ['read', 'write', 'exec', 'message'],
      memoryPath: null,
      description: 'Top-level orchestrator.',
    })
  }

  // Build child agents from agents/ subdirectories
  agentDirs.forEach((dirName, i) => {
    let name = slugToName(dirName)
    let title = 'Agent'

    try {
      const content = readFileSync(join(agentsDir, dirName, 'SOUL.md'), 'utf-8')
      const extracted = extractNameFromSoul(content)
      if (extracted) name = extracted
      const roleMatch = content.match(/^(?:Role|Title):\s*(.+)/mi)
      if (roleMatch) title = roleMatch[1].trim()
    } catch {}

    discovered.push({
      id: dirName,
      name,
      title,
      reportsTo: hasRoot ? rootId : null,
      directReports: [],
      soulPath: `agents/${dirName}/SOUL.md`,
      voiceId: null,
      color: DISCOVER_COLORS[(i + 1) % DISCOVER_COLORS.length],
      emoji: name.charAt(0).toUpperCase(),
      tools: ['read', 'write'],
      memoryPath: null,
      description: `${name} agent.`,
    })
  })

  return discovered.length > 0 ? discovered : null
}

/**
 * Load the agent registry.
 *
 * Resolution order:
 *   1. $WORKSPACE_PATH/clawport/agents.json  (user's own config)
 *   2. Auto-discovered from $WORKSPACE_PATH   (agents/ directory scan)
 *   3. Bundled lib/agents.json               (default example registry)
 */
export function loadRegistry(): AgentEntry[] {
  const workspacePath = process.env.WORKSPACE_PATH

  if (workspacePath) {
    // 1. User-provided override
    const userRegistryPath = join(workspacePath, 'clawport', 'agents.json')
    if (existsSync(userRegistryPath)) {
      try {
        const raw = readFileSync(userRegistryPath, 'utf-8')
        return JSON.parse(raw) as AgentEntry[]
      } catch {
        // Malformed user JSON -- fall through
      }
    }

    // 2. Auto-discover from workspace
    const discovered = discoverAgents(workspacePath)
    if (discovered) return discovered
  }

  // 3. Bundled fallback
  return bundledRegistry as AgentEntry[]
}
