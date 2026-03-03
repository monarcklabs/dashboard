"use client"
import {
  ReactFlow,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  ConnectionLineType,
} from "@xyflow/react"
import { useCallback, useEffect } from "react"
import type { Agent, CronJob } from "@/lib/types"
import { nodeTypes } from "@/components/AgentNode"

interface OrgMapProps {
  agents: Agent[]
  crons: CronJob[]
  selectedId: string | null
  onNodeClick: (agent: Agent) => void
}

function buildLayout(
  agents: Agent[],
  crons: CronJob[],
  selectedId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const agentMap = new Map(agents.map((a) => [a.id, a]))
  const withCrons = agents.map((a) => ({
    ...a,
    crons: crons.filter((c) => c.agentId === a.id),
  }))
  const agentMapWithCrons = new Map(withCrons.map((a) => [a.id, a]))

  // BFS to determine levels
  const levels: string[][] = []
  const visited = new Set<string>()
  const root = agents.find((a) => a.reportsTo === null)
  if (!root) return { nodes: [], edges: [] }

  let queue = [root.id]
  while (queue.length > 0) {
    levels.push([...queue])
    queue.forEach((id) => visited.add(id))
    const nextQueue: string[] = []
    for (const id of queue) {
      const agent = agentMap.get(id)
      if (!agent) continue
      for (const childId of agent.directReports) {
        if (!visited.has(childId)) nextQueue.push(childId)
      }
    }
    queue = nextQueue
  }

  // Pick up disconnected agents
  const disconnected = agents.filter((a) => !visited.has(a.id))
  if (disconnected.length > 0) levels.push(disconnected.map((a) => a.id))

  const LEVEL_HEIGHT = 200
  const nodes: Node[] = []

  for (let level = 0; level < levels.length; level++) {
    const ids = levels[level]
    const spacing = Math.max(200, Math.min(260, 1600 / Math.max(ids.length, 1)))
    const totalWidth = ids.length * spacing
    const startX = 600 - totalWidth / 2 + spacing / 2

    ids.forEach((id, i) => {
      const agent = agentMapWithCrons.get(id)
      if (!agent) return
      nodes.push({
        id,
        type: "agentNode",
        data: agent as unknown as Record<string, unknown>,
        position: { x: startX + i * spacing - spacing / 2, y: level * LEVEL_HEIGHT + 20 },
        selected: id === selectedId,
      })
    })
  }

  // Build edges -- selected agent's edges get accent color
  const selectedAgentIds = new Set<string>()
  if (selectedId) {
    selectedAgentIds.add(selectedId)
    const selectedAgent = agentMap.get(selectedId)
    if (selectedAgent) {
      if (selectedAgent.reportsTo) selectedAgentIds.add(selectedAgent.reportsTo)
      selectedAgent.directReports.forEach((id) => selectedAgentIds.add(id))
    }
  }

  const edges: Edge[] = []
  for (const agent of agents) {
    for (const childId of agent.directReports) {
      const isHighlighted =
        selectedId && selectedAgentIds.has(agent.id) && selectedAgentIds.has(childId)

      edges.push({
        id: `${agent.id}-${childId}`,
        source: agent.id,
        target: childId,
        type: "smoothstep",
        style: {
          stroke: isHighlighted ? "var(--accent)" : "var(--separator)",
          strokeWidth: isHighlighted ? 2 : 1.5,
          opacity: isHighlighted ? 1 : 0.6,
          strokeDasharray: isHighlighted ? undefined : "6 4",
        },
        animated: !!isHighlighted,
      })
    }
  }

  return { nodes, edges }
}

export function OrgMap({ agents, crons, selectedId, onNodeClick }: OrgMapProps) {
  const { nodes: initialNodes, edges: initialEdges } = buildLayout(agents, crons, selectedId)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    const { nodes: n, edges: e } = buildLayout(agents, crons, selectedId)
    setNodes(n)
    setEdges(e)
  }, [agents, crons, selectedId, setNodes, setEdges])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const agent = agents.find((a) => a.id === node.id)
      if (agent) onNodeClick(agent)
    },
    [agents, onNodeClick],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      connectionLineType={ConnectionLineType.SmoothStep}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Controls
        position="bottom-left"
        style={{ left: 16, bottom: 16 }}
      />
    </ReactFlow>
  )
}
