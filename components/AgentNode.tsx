"use client"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import type { Agent, CronJob } from "@/lib/types"

type AgentNodeData = Agent & { crons: CronJob[] } & Record<string, unknown>

export function AgentNode({ data, selected }: NodeProps) {
  const agent = data as AgentNodeData
  const hasCrons = agent.crons && agent.crons.length > 0
  const hasErrors = hasCrons && agent.crons.some((c: CronJob) => c.status === "error")
  const cronCount = hasCrons ? agent.crons.length : 0

  return (
    <div
      className={`hover-lift focus-ring${selected ? " node-selected" : ""}`}
      title={agent.title}
      style={{
        background: "var(--material-regular)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${selected ? "var(--accent)" : "var(--separator)"}`,
        borderTop: `2px solid ${agent.color}`,
        padding: "var(--space-3) var(--space-4)",
        minWidth: 200,
        maxWidth: 220,
        cursor: "pointer",
        position: "relative",
        boxShadow: selected ? "0 0 0 1px var(--accent), var(--shadow-card)" : "var(--shadow-card)",
      }}
    >
      {/* Emoji + Name row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          marginBottom: "var(--space-1)",
        }}
      >
        <div
          style={{
            fontSize: 20,
            width: 30,
            height: 30,
            borderRadius: 8,
            background: `${agent.color}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {agent.emoji}
        </div>
        <div
          style={{
            fontSize: "var(--text-body)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {agent.name}
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: "var(--text-caption1)",
          color: "var(--text-secondary)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          marginTop: 1,
        }}
      >
        {agent.title}
      </div>

      {/* Description snippet */}
      {agent.description && (
        <div
          style={{
            fontSize: "var(--text-caption2)",
            color: "var(--text-tertiary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginTop: 2,
          }}
        >
          {agent.description}
        </div>
      )}

      {/* Cron health row */}
      {hasCrons && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: "var(--space-2)",
            fontSize: "var(--text-caption2)",
            color: hasErrors ? "var(--system-red)" : "var(--system-green)",
          }}
        >
          <div
            className={hasErrors ? "animate-error-pulse" : ""}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: hasErrors ? "var(--system-red)" : "var(--system-green)",
              flexShrink: 0,
            }}
          />
          {cronCount} cron{cronCount !== 1 ? "s" : ""} · {hasErrors ? "errors" : "healthy"}
        </div>
      )}

      {/* Handles - invisible */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

export const nodeTypes = { agentNode: AgentNode }
