'use client'

import { useCallback, useEffect, useState } from 'react'
import { PlugZap, RefreshCw } from 'lucide-react'
import type { IntegrationBindingSummary, IntegrationItem, IntegrationsSummary } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ErrorState'

function SummaryCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'warn' }) {
  const color =
    tone === 'good' ? 'var(--system-green)' : tone === 'warn' ? 'var(--system-orange)' : 'var(--text-primary)'
  return (
    <div style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
    }}>
      <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-title3)', fontWeight: 'var(--weight-bold)', color }}>
        {value}
      </div>
    </div>
  )
}

function ConfigList({ title, items, empty }: { title: string; items: IntegrationItem[]; empty: string }) {
  return (
    <section style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--separator)' }}>
        <h2 style={{ fontSize: 'var(--text-headline)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: 0 }}>
          {title}
        </h2>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: 'var(--space-5)', color: 'var(--text-tertiary)', fontSize: 'var(--text-footnote)' }}>
          {empty}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item, index) => (
            <div
              key={item.id}
              style={{
                padding: 'var(--space-4) var(--space-5)',
                borderTop: index === 0 ? 'none' : '1px solid var(--separator)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'center' }}>
                <div style={{ fontSize: 'var(--text-footnote)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                  {item.id}
                </div>
                <span style={{
                  fontSize: 'var(--text-caption2)',
                  fontWeight: 600,
                  color:
                    item.enabled === true ? 'var(--system-green)' :
                    item.enabled === false ? 'var(--system-red)' :
                    'var(--text-tertiary)',
                  background: 'var(--fill-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '2px var(--space-2)',
                  textTransform: 'uppercase',
                }}>
                  {item.enabled === true ? 'enabled' : item.enabled === false ? 'disabled' : 'configured'}
                </span>
              </div>
              {item.summary.length > 0 && (
                <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {item.summary.map((line) => (
                    <div key={line} style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function BindingList({ bindings }: { bindings: IntegrationBindingSummary[] }) {
  return (
    <section style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--separator)' }}>
        <h2 style={{ fontSize: 'var(--text-headline)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: 0 }}>
          Bindings
        </h2>
      </div>
      {bindings.length === 0 ? (
        <div style={{ padding: 'var(--space-5)', color: 'var(--text-tertiary)', fontSize: 'var(--text-footnote)' }}>
          No channel bindings found in the VM config.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {bindings.map((binding, index) => (
            <div
              key={`${binding.agentId}-${binding.channel}-${binding.peer}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr)',
                gap: 'var(--space-3)',
                padding: 'var(--space-4) var(--space-5)',
                borderTop: index === 0 ? 'none' : '1px solid var(--separator)',
              }}
            >
              <div>
                <div style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Agent</div>
                <div style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{binding.agentId}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Channel</div>
                <div style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-primary)' }}>{binding.channel}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Peer</div>
                <div style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{binding.peer}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function IntegrationsPage() {
  const [data, setData] = useState<IntegrationsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setRefreshing(true)
    setError(null)
    fetch('/api/integrations')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load integrations')
        return res.json()
      })
      .then((next: IntegrationsSummary) => {
        setData(next)
        setLoading(false)
        setRefreshing(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (error && !data) {
    return <ErrorState message={error} onRetry={refresh} />
  }

  if (loading || !data) {
    return (
      <div className="h-full flex flex-col overflow-hidden animate-fade-in" style={{ background: 'var(--bg)' }}>
        <div style={{ padding: 'var(--space-6)', display: 'grid', gap: 'var(--space-4)' }}>
          <Skeleton className="h-10 w-48" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  const totalConfigured = data.channels.length + data.tools.length + data.plugins.length + data.skills.length

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in" style={{ background: 'var(--bg)' }}>
      <header
        className="sticky top-0 z-10 flex-shrink-0"
        style={{
          background: 'var(--material-regular)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderBottom: '1px solid var(--separator)',
        }}
      >
        <div className="flex items-center justify-between" style={{ padding: 'var(--space-4) var(--space-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-title1)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', margin: 0 }}>
              Integrations
            </h1>
            <p style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
              Runtime config discovered from the VM workspace and OpenClaw config. Secret values are redacted.
            </p>
          </div>
          <button
            onClick={refresh}
            className="focus-ring"
            aria-label="Refresh integrations"
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
            <SummaryCard label="Workspace" value={data.workspacePath ? 'Detected' : 'Missing'} tone={data.workspacePath ? 'good' : 'warn'} />
            <SummaryCard label="Config File" value={data.configFound ? 'Loaded' : 'Missing'} tone={data.configFound ? 'good' : 'warn'} />
            <SummaryCard label="Configured Entries" value={String(totalConfigured)} />
            <SummaryCard label="Bindings" value={String(data.bindings.length)} />
          </div>

          <section style={{
            background: 'var(--material-regular)',
            border: '1px solid var(--separator)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4) var(--space-5)',
          }}>
            <div className="flex items-center" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <PlugZap size={18} />
              <h2 style={{ fontSize: 'var(--text-headline)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', margin: 0 }}>
                Environment
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Workspace Path</div>
                <div style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{data.workspacePath || 'Not set'}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>OpenClaw Binary</div>
                <div style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{data.openclawBin || 'Not found'}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Config Path</div>
                <div style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{data.configPath || 'Not resolved'}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Gateway HTTP</div>
                <div style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-primary)' }}>
                  Port {data.gatewayPort ?? 'n/a'} · Chat completions {data.httpEndpointEnabled === true ? 'enabled' : data.httpEndpointEnabled === false ? 'disabled' : 'unknown'}
                </div>
              </div>
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
            <ConfigList title="Channels" items={data.channels} empty="No channels configured in openclaw.json." />
            <ConfigList title="Tools" items={data.tools} empty="No tools configured in openclaw.json." />
            <ConfigList title="Plugins" items={data.plugins} empty="No plugin entries configured." />
            <ConfigList title="Skills" items={data.skills} empty="No skill entries configured." />
          </div>

          <BindingList bindings={data.bindings} />
        </div>
      </div>
    </div>
  )
}
