"use client"
import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import type { Agent, CronJob } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/ErrorState"

const ManorMap = dynamic(
  () => import("@/components/ManorMap").then((m) => ({ default: m.ManorMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Skeleton width={240} height={12} />
          <Skeleton width={180} height={12} />
          <Skeleton width={200} height={12} />
        </div>
      </div>
    ),
  },
)

const TOOL_ICONS: Record<string, string> = {
  web_search: "\uD83D\uDD0D",
  read: "\uD83D\uDCC1",
  write: "\u270F\uFE0F",
  exec: "\uD83D\uDCBB",
  web_fetch: "\uD83C\uDF10",
  message: "\uD83D\uDD14",
  tts: "\uD83D\uDCAC",
  edit: "\u2702\uFE0F",
  sessions_spawn: "\uD83D\uDD04",
  memory_search: "\uD83E\udDE0",
}

function StatusDot({ status }: { status: CronJob["status"] }) {
  return (
    <span
      className={status === "error" ? "animate-error-pulse" : ""}
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        flexShrink: 0,
        background:
          status === "ok"
            ? "var(--system-green)"
            : status === "error"
              ? "var(--system-red)"
              : "var(--text-tertiary)",
      }}
    />
  )
}

/* ──────────────────────────────────────────────
   Loading skeleton for the map area
   ────────────────────────────────────────────── */
function MapSkeleton() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-6"
      style={{ padding: "var(--space-8)" }}
    >
      {/* Fake root node */}
      <Skeleton width={160} height={80} style={{ borderRadius: "var(--radius-md)" }} />
      {/* Fake second row */}
      <div className="flex gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton
            key={i}
            width={140}
            height={72}
            style={{ borderRadius: "var(--radius-md)" }}
          />
        ))}
      </div>
      {/* Fake third row */}
      <div className="flex gap-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton
            key={i}
            width={130}
            height={64}
            style={{ borderRadius: "var(--radius-md)" }}
          />
        ))}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────
   Main page
   ────────────────────────────────────────────── */
export default function ManorPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [crons, setCrons] = useState<CronJob[]>([])
  const [selected, setSelected] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch("/api/agents").then((r) => {
        if (!r.ok) throw new Error("Failed to fetch agents")
        return r.json()
      }),
      fetch("/api/crons").then((r) => {
        if (!r.ok) throw new Error("Failed to fetch crons")
        return r.json()
      }),
    ])
      .then(([a, c]) => {
        setAgents(a)
        setCrons(c)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Focus close button when panel opens
  useEffect(() => {
    if (selected && closeRef.current) {
      closeRef.current.focus()
    }
  }, [selected])

  // Keyboard: ESC closes panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selected) {
        setSelected(null)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selected])

  const agentCrons = selected ? crons.filter((c) => c.agentId === selected.id) : []

  // Find hierarchy info for the detail panel
  const parentAgent = selected?.reportsTo
    ? agents.find((a) => a.id === selected.reportsTo)
    : null
  const childAgents = selected
    ? selected.directReports
        .map((cid) => agents.find((a) => a.id === cid))
        .filter(Boolean) as Agent[]
    : []

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />
  }

  return (
    <div className="flex h-full relative" style={{ background: "var(--bg)" }}>
      {/* ── Map area ── */}
      <div className="flex-1 h-full relative">
        {loading ? (
          <MapSkeleton />
        ) : (
          <ManorMap
            agents={agents}
            crons={crons}
            selectedId={selected?.id ?? null}
            onNodeClick={setSelected}
          />
        )}

        {/* Legend -- top right */}
        <div
          className="hidden md:flex"
          style={{
            position: "absolute",
            top: "var(--space-4)",
            right: "var(--space-4)",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-sm)",
            background: "var(--material-regular)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid var(--separator)",
            fontSize: "var(--text-caption2)",
            color: "var(--text-tertiary)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--system-green)",
                display: "inline-block",
              }}
            />
            Healthy
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--system-red)",
                display: "inline-block",
              }}
            />
            Errors
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--text-tertiary)",
                display: "inline-block",
              }}
            />
            No crons
          </span>
        </div>
      </div>

      {/* ── Mobile backdrop ── */}
      {selected && (
        <div
          className="fixed inset-0 z-30 md:hidden backdrop-fade"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSelected(null)}
        />
      )}

      {/* ── Detail panel ── */}
      {selected && (
        <div
          className="fixed inset-0 z-40 md:absolute md:inset-y-0 md:right-0 md:left-auto md:z-30 panel-slide-in"
        >
          <div
            className="h-full flex flex-col ml-auto"
            style={{
              width: "100%",
              maxWidth: 380,
              flexShrink: 0,
              overflowY: "auto",
              background: "var(--bg)",
              boxShadow: "var(--shadow-overlay)",
            }}
          >
            {/* ── Toolbar row ── */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--bg)",
              }}
            >
              <button
                ref={closeRef}
                onClick={() => setSelected(null)}
                className="focus-ring"
                aria-label="Close detail panel"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--fill-tertiary)",
                  color: "var(--text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: "var(--weight-semibold)",
                  transition: "all 150ms var(--ease-spring)",
                }}
              >
                &#x2715;
              </button>
            </div>

            {/* ── Hero header ── */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "0 var(--space-6) var(--space-6)",
              }}
            >
              {/* Emoji avatar */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: `${selected.color}22`,
                  border: `1px solid ${selected.color}40`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                  marginBottom: "var(--space-3)",
                  boxShadow: `0 4px 20px ${selected.color}18`,
                }}
              >
                {selected.emoji}
              </div>

              <h2
                style={{
                  fontSize: "var(--text-title2)",
                  fontWeight: "var(--weight-bold)",
                  letterSpacing: "var(--tracking-tight)",
                  color: "var(--text-primary)",
                  margin: 0,
                  lineHeight: "var(--leading-tight)",
                }}
              >
                {selected.name}
              </h2>

              <p
                style={{
                  fontSize: "var(--text-subheadline)",
                  fontWeight: "var(--weight-regular)",
                  color: selected.color,
                  margin: "2px 0 0",
                  opacity: 0.85,
                }}
              >
                {selected.title}
              </p>

              {selected.description && (
                <p
                  style={{
                    fontSize: "var(--text-footnote)",
                    lineHeight: "var(--leading-normal)",
                    color: "var(--text-secondary)",
                    margin: "var(--space-2) 0 0",
                    maxWidth: 280,
                  }}
                >
                  {selected.description}
                </p>
              )}

              {/* Quick action buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  marginTop: "var(--space-4)",
                  width: "100%",
                  maxWidth: 280,
                }}
              >
                <button
                  onClick={() => router.push(`/chat/${selected.id}`)}
                  className="focus-ring"
                  aria-label={`Open chat with ${selected.name}`}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--space-2)",
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--accent)",
                    color: "#000",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "var(--text-subheadline)",
                    fontWeight: "var(--weight-semibold)",
                    transition: "all 150ms var(--ease-spring)",
                  }}
                >
                  Message
                </button>
                <Link
                  href={`/agents/${selected.id}`}
                  className="focus-ring"
                  aria-label={`View full profile of ${selected.name}`}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--space-2)",
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--fill-tertiary)",
                    color: "var(--text-primary)",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "var(--text-subheadline)",
                    fontWeight: "var(--weight-semibold)",
                    textDecoration: "none",
                    transition: "all 150ms var(--ease-spring)",
                  }}
                >
                  Profile
                </Link>
              </div>
            </div>

            {/* ── Grouped sections ── */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-8)",
                padding: "var(--space-2) var(--space-4) var(--space-8)",
              }}
            >
              {/* TOOLS */}
              <div>
                <div
                  style={{
                    fontSize: "var(--text-caption1)",
                    fontWeight: "var(--weight-semibold)",
                    letterSpacing: "var(--tracking-wide)",
                    textTransform: "uppercase",
                    color: "var(--text-tertiary)",
                    padding: "0 var(--space-4) var(--space-2)",
                  }}
                >
                  Capabilities
                </div>
                <div
                  style={{
                    background: "var(--material-regular)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--separator)",
                    overflow: "hidden",
                  }}
                >
                  {selected.tools.map((t, idx) => (
                    <div
                      key={t}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "var(--space-3) var(--space-4)",
                        borderTop: idx > 0 ? "1px solid var(--separator)" : undefined,
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 7,
                          background: "var(--fill-tertiary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "var(--text-footnote)",
                          flexShrink: 0,
                        }}
                      >
                        {TOOL_ICONS[t] || "\u2699\uFE0F"}
                      </span>
                      <span
                        style={{
                          fontSize: "var(--text-body)",
                          color: "var(--text-primary)",
                          flex: 1,
                        }}
                      >
                        {t.replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* HIERARCHY */}
              {(parentAgent || childAgents.length > 0) && (
                <div>
                  <div
                    style={{
                      fontSize: "var(--text-caption1)",
                      fontWeight: "var(--weight-semibold)",
                      letterSpacing: "var(--tracking-wide)",
                      textTransform: "uppercase",
                      color: "var(--text-tertiary)",
                      padding: "0 var(--space-4) var(--space-2)",
                    }}
                  >
                    Organization
                  </div>
                  <div
                    style={{
                      background: "var(--material-regular)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--separator)",
                      overflow: "hidden",
                    }}
                  >
                    {parentAgent && (
                      <button
                        className="focus-ring"
                        aria-label={`Select ${parentAgent.name}`}
                        onClick={() => setSelected(parentAgent)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-3)",
                          padding: "var(--space-3) var(--space-4)",
                          width: "100%",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 9,
                            background: `${parentAgent.color}20`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "var(--text-body)",
                            flexShrink: 0,
                          }}
                        >
                          {parentAgent.emoji}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "var(--text-body)",
                              fontWeight: "var(--weight-medium)",
                              color: "var(--text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {parentAgent.name}
                          </div>
                          <div
                            style={{
                              fontSize: "var(--text-caption1)",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            Reports to
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: "var(--text-body)",
                            color: "var(--text-quaternary)",
                            flexShrink: 0,
                          }}
                        >
                          &#x203A;
                        </span>
                      </button>
                    )}
                    {childAgents.map((c, idx) => (
                      <button
                        key={c.id}
                        className="focus-ring"
                        aria-label={`Select ${c.name}`}
                        onClick={() => setSelected(c)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-3)",
                          padding: "var(--space-3) var(--space-4)",
                          width: "100%",
                          background: "none",
                          border: "none",
                          borderTop: (parentAgent || idx > 0) ? "1px solid var(--separator)" : undefined,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 9,
                            background: `${c.color}20`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "var(--text-body)",
                            flexShrink: 0,
                          }}
                        >
                          {c.emoji}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "var(--text-body)",
                              fontWeight: "var(--weight-medium)",
                              color: "var(--text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {c.name}
                          </div>
                          <div
                            style={{
                              fontSize: "var(--text-caption1)",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            Direct report
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: "var(--text-body)",
                            color: "var(--text-quaternary)",
                            flexShrink: 0,
                          }}
                        >
                          &#x203A;
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CRONS */}
              {agentCrons.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: "var(--text-caption1)",
                      fontWeight: "var(--weight-semibold)",
                      letterSpacing: "var(--tracking-wide)",
                      textTransform: "uppercase",
                      color: "var(--text-tertiary)",
                      padding: "0 var(--space-4) var(--space-2)",
                    }}
                  >
                    Scheduled Tasks
                  </div>
                  <div
                    style={{
                      background: "var(--material-regular)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--separator)",
                      overflow: "hidden",
                    }}
                  >
                    {agentCrons.map((c, idx) => (
                      <div
                        key={c.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-3)",
                          padding: "var(--space-3) var(--space-4)",
                          borderTop: idx > 0 ? "1px solid var(--separator)" : undefined,
                        }}
                      >
                        <StatusDot status={c.status} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "var(--text-body)",
                              fontWeight: "var(--weight-medium)",
                              color: "var(--text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {c.name}
                          </div>
                          {c.lastError && (
                            <div
                              style={{
                                fontSize: "var(--text-caption1)",
                                color: "var(--system-red)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                marginTop: 1,
                              }}
                            >
                              {c.lastError}
                            </div>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: "var(--text-caption1)",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-tertiary)",
                            flexShrink: 0,
                            background: "var(--fill-quaternary)",
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {c.schedule}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
