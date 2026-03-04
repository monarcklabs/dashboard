// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockReadFileSync, mockExistsSync, mockReaddirSync, bundledAgents } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  bundledAgents: [
    {
      id: 'jarvis',
      name: 'Jarvis',
      title: 'Orchestrator',
      reportsTo: null,
      directReports: ['vera', 'lumen', 'pulse'],
      soulPath: 'SOUL.md',
      voiceId: 'agL69Vji082CshT65Tcy',
      color: '#f5c518',
      emoji: 'R',
      tools: ['exec', 'read', 'write'],
      memoryPath: null,
      description: 'Top-level orchestrator.',
    },
    {
      id: 'vera',
      name: 'VERA',
      title: 'Chief Strategy Officer',
      reportsTo: 'jarvis',
      directReports: ['robin'],
      soulPath: 'agents/vera/SOUL.md',
      voiceId: 'EAHourGM2PqzHHl0Ywjp',
      color: '#a855f7',
      emoji: 'P',
      tools: ['web_search', 'read'],
      memoryPath: null,
      description: 'CSO. Decides what gets built.',
    },
    {
      id: 'robin',
      name: 'Robin',
      title: 'Field Intel Operator',
      reportsTo: 'vera',
      directReports: [],
      soulPath: 'agents/robin/SOUL.md',
      voiceId: null,
      color: '#3b82f6',
      emoji: 'E',
      tools: ['web_search'],
      memoryPath: null,
      description: 'Field operator.',
    },
    {
      id: 'lumen',
      name: 'LUMEN',
      title: 'SEO Team Director',
      reportsTo: 'jarvis',
      directReports: ['scout'],
      soulPath: 'agents/seo-team/SOUL.md',
      voiceId: null,
      color: '#22c55e',
      emoji: 'L',
      tools: ['web_search', 'read'],
      memoryPath: null,
      description: 'SEO Team Director.',
    },
    {
      id: 'scout',
      name: 'SCOUT',
      title: 'Content Scout',
      reportsTo: 'lumen',
      directReports: [],
      soulPath: null,
      voiceId: null,
      color: '#86efac',
      emoji: 'S',
      tools: ['web_search'],
      memoryPath: null,
      description: 'Scouts trending topics.',
    },
    {
      id: 'pulse',
      name: 'Pulse',
      title: 'Trend Radar',
      reportsTo: 'jarvis',
      directReports: [],
      soulPath: 'agents/pulse/SOUL.md',
      voiceId: null,
      color: '#eab308',
      emoji: 'W',
      tools: ['web_search'],
      memoryPath: null,
      description: 'Hype radar.',
    },
    {
      id: 'kaze',
      name: 'KAZE',
      title: 'Japan Flight Monitor',
      reportsTo: 'jarvis',
      directReports: [],
      soulPath: null,
      voiceId: null,
      color: '#60a5fa',
      emoji: 'A',
      tools: ['web_fetch'],
      memoryPath: null,
      description: 'Monitors flights.',
    },
  ],
}))

// Mock fs (Dependency Inversion -- no real file system access in tests)
vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  default: { readFileSync: mockReadFileSync, existsSync: mockExistsSync, readdirSync: mockReaddirSync },
}))

// Mock the bundled agents.json
vi.mock('@/lib/agents.json', () => ({
  default: bundledAgents,
}))

// We need to import AFTER mocks are set up
import { getAgents, getAgent } from './agents'

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  // Default: no files exist on disk, no directories
  mockExistsSync.mockReturnValue(false)
  mockReaddirSync.mockReturnValue([])
})

/** Helper: block auto-discovery paths so bundled registry is used */
function blockDiscovery(ws: string) {
  return (p: string) => {
    if (p === `${ws}/clawport/agents.json`) return false
    if (p === `${ws}/SOUL.md`) return false
    if (p === `${ws}/agents`) return false
    return false
  }
}

// ---------------------------------------------------------------------------
// Registry loading: bundled fallback vs workspace override vs auto-discovery
// ---------------------------------------------------------------------------

describe('agent registry loading', () => {
  it('loads from bundled JSON when WORKSPACE_PATH is not set', async () => {
    vi.stubEnv('WORKSPACE_PATH', '')
    const agents = await getAgents()
    expect(agents.length).toBe(bundledAgents.length)
    expect(agents.map(a => a.id)).toContain('jarvis')
  })

  it('loads from bundled JSON when workspace override file does not exist', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')
    mockExistsSync.mockReturnValue(false)
    const agents = await getAgents()
    expect(agents.length).toBe(bundledAgents.length)
  })

  it('loads from workspace override when clawport/agents.json exists', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')

    const customAgents = [
      {
        id: 'custom-bot',
        name: 'CustomBot',
        title: 'Custom Agent',
        reportsTo: null,
        directReports: [],
        soulPath: null,
        voiceId: null,
        color: '#ff0000',
        emoji: 'C',
        tools: ['read'],
        memoryPath: null,
        description: 'A custom agent.',
      },
    ]

    mockExistsSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/clawport/agents.json') return true
      return false
    })
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/clawport/agents.json') {
        return JSON.stringify(customAgents)
      }
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents.length).toBe(1)
    expect(agents[0].id).toBe('custom-bot')
    expect(agents[0].name).toBe('CustomBot')
  })

  it('falls back to bundled JSON when workspace agents.json is malformed', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')

    mockExistsSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/clawport/agents.json') return true
      return false
    })
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/clawport/agents.json') {
        return '{ invalid json !!!'
      }
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    // Should fall back to bundled agents, not crash
    expect(agents.length).toBe(bundledAgents.length)
    expect(agents.map(a => a.id)).toContain('jarvis')
  })

  it('falls back to bundled JSON when workspace agents.json read throws', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')

    mockExistsSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/clawport/agents.json') return true
      return false
    })
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/clawport/agents.json') {
        throw new Error('EACCES')
      }
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents.length).toBe(bundledAgents.length)
  })

  it('prioritizes user override over auto-discovery', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    const customAgents = [
      { id: 'custom', name: 'Custom', title: 'Agent', reportsTo: null, directReports: [], soulPath: null, voiceId: null, color: '#ff0000', emoji: 'C', tools: ['read'], memoryPath: null, description: 'Custom.' },
    ]

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return true
      // These would trigger discovery, but override takes priority
      if (p === '/tmp/ws/SOUL.md') return true
      if (p === '/tmp/ws/agents') return true
      return false
    })
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return JSON.stringify(customAgents)
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents).toHaveLength(1)
    expect(agents[0].id).toBe('custom')
  })
})

// ---------------------------------------------------------------------------
// Auto-discovery from workspace
// ---------------------------------------------------------------------------

describe('auto-discovery from workspace', () => {
  it('discovers agents from workspace agents/ directory', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return true
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/bot-a/SOUL.md') return true
      if (p === '/tmp/ws/agents/bot-b/SOUL.md') return true
      return false
    })

    mockReaddirSync.mockReturnValue([
      { name: 'bot-a', isDirectory: () => true },
      { name: 'bot-b', isDirectory: () => true },
      { name: 'README.md', isDirectory: () => false },
    ])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/SOUL.md') return '# MyOrchestrator'
      if (p === '/tmp/ws/agents/bot-a/SOUL.md') return '# Bot Alpha\nRole: Data Analyst'
      if (p === '/tmp/ws/agents/bot-b/SOUL.md') return '# Bot Beta'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents).toHaveLength(3) // root + 2 agents

    const root = agents.find(a => a.reportsTo === null)!
    expect(root.name).toBe('MyOrchestrator')
    expect(root.soulPath).toBe('SOUL.md')
    expect(root.soul).toBe('# MyOrchestrator')
    expect(root.directReports).toEqual(['bot-a', 'bot-b'])

    const botA = agents.find(a => a.id === 'bot-a')!
    expect(botA.name).toBe('Bot Alpha')
    expect(botA.title).toBe('Data Analyst')
    expect(botA.reportsTo).toBe(root.id)
    expect(botA.soulPath).toBe('agents/bot-a/SOUL.md')
    expect(botA.soul).toBe('# Bot Alpha\nRole: Data Analyst')

    const botB = agents.find(a => a.id === 'bot-b')!
    expect(botB.name).toBe('Bot Beta')
    expect(botB.reportsTo).toBe(root.id)
  })

  it('discovers agents without root SOUL.md (flat structure)', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/worker/SOUL.md') return true
      return false
    })

    mockReaddirSync.mockReturnValue([
      { name: 'worker', isDirectory: () => true },
    ])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/agents/worker/SOUL.md') return '# Worker Bot'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents).toHaveLength(1)
    expect(agents[0].id).toBe('worker')
    expect(agents[0].name).toBe('Worker Bot')
    expect(agents[0].reportsTo).toBeNull()
  })

  it('falls back to bundled when no agents/ dir and no root SOUL.md', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockReturnValue(false)
    const agents = await getAgents()
    expect(agents.length).toBe(bundledAgents.length)
  })

  it('skips directories without SOUL.md', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return true
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/valid/SOUL.md') return true
      if (p === '/tmp/ws/agents/empty/SOUL.md') return false // no SOUL.md
      return false
    })

    mockReaddirSync.mockReturnValue([
      { name: 'valid', isDirectory: () => true },
      { name: 'empty', isDirectory: () => true },
    ])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/SOUL.md') return '# Root'
      if (p === '/tmp/ws/agents/valid/SOUL.md') return '# Valid Agent'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    // root + 1 valid agent (empty skipped)
    expect(agents).toHaveLength(2)
    expect(agents.map(a => a.id)).not.toContain('empty')
  })

  it('uses directory name as fallback when SOUL.md has no heading', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')

    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/agents') return true
      if (p === '/tmp/ws/agents/my-bot/SOUL.md') return true
      return false
    })

    mockReaddirSync.mockReturnValue([
      { name: 'my-bot', isDirectory: () => true },
    ])

    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/agents/my-bot/SOUL.md') return 'No heading here, just text.'
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents).toHaveLength(1)
    expect(agents[0].id).toBe('my-bot')
    expect(agents[0].name).toBe('My Bot') // slugToName
  })
})

// ---------------------------------------------------------------------------
// getAgents
// ---------------------------------------------------------------------------

describe('getAgents', () => {
  it('returns all agents from the registry', async () => {
    const agents = await getAgents()
    expect(agents.length).toBeGreaterThan(0)
  })

  it('every agent has required fields', async () => {
    const agents = await getAgents()
    for (const agent of agents) {
      expect(agent.id).toEqual(expect.any(String))
      expect(agent.name).toEqual(expect.any(String))
      expect(agent.title).toEqual(expect.any(String))
      expect(agent.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(agent.emoji).toEqual(expect.any(String))
      expect(Array.isArray(agent.tools)).toBe(true)
      expect(Array.isArray(agent.directReports)).toBe(true)
      expect(Array.isArray(agent.crons)).toBe(true)
      expect(agent.description).toEqual(expect.any(String))
    }
  })

  it('includes known agents by id', async () => {
    const agents = await getAgents()
    const ids = agents.map(a => a.id)
    expect(ids).toContain('jarvis')
    expect(ids).toContain('vera')
    expect(ids).toContain('lumen')
    expect(ids).toContain('pulse')
    expect(ids).toContain('kaze')
  })

  it('sets soul to null when WORKSPACE_PATH is not set', async () => {
    vi.stubEnv('WORKSPACE_PATH', '')
    const agents = await getAgents()
    const jarvis = agents.find(a => a.id === 'jarvis')!
    expect(jarvis.soulPath).toBeTruthy()
    expect(jarvis.soul).toBeNull()
  })

  it('sets soul to null when soulPath file does not exist', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockReturnValue(false)
    const agents = await getAgents()
    const jarvis = agents.find(a => a.id === 'jarvis')!
    expect(jarvis.soulPath).toBeTruthy()
    expect(jarvis.soul).toBeNull()
  })

  it('reads soul content when soulPath file exists', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockImplementation((p: string) => {
      // Block auto-discovery, allow SOUL file reads for bundled agents
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/agents') return false
      return true
    })
    mockReadFileSync.mockReturnValue('# Agent SOUL content')
    const agents = await getAgents()
    // vera has soulPath: 'agents/vera/SOUL.md' which won't conflict with discovery
    const vera = agents.find(a => a.id === 'vera')!
    expect(vera.soul).toBe('# Agent SOUL content')
  })

  it('sets soul to null when readFileSync throws', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockImplementation((p: string) => {
      if (p === '/tmp/ws/clawport/agents.json') return false
      if (p === '/tmp/ws/SOUL.md') return false
      if (p === '/tmp/ws/agents') return false
      return true
    })
    mockReadFileSync.mockImplementation(() => { throw new Error('EACCES') })
    const agents = await getAgents()
    const vera = agents.find(a => a.id === 'vera')!
    expect(vera.soul).toBeNull()
  })

  it('initializes crons as empty array for every agent', async () => {
    const agents = await getAgents()
    for (const agent of agents) {
      expect(agent.crons).toEqual([])
    }
  })

  it('agents with no soulPath get soul=null without reading fs', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockReturnValue(false)
    const agents = await getAgents()
    const scout = agents.find(a => a.id === 'scout')!
    expect(scout.soulPath).toBeNull()
    expect(scout.soul).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getAgent
// ---------------------------------------------------------------------------

describe('getAgent', () => {
  it('returns the correct agent by id', async () => {
    const agent = await getAgent('vera')
    expect(agent).not.toBeNull()
    expect(agent!.id).toBe('vera')
    expect(agent!.name).toBe('VERA')
    expect(agent!.title).toBe('Chief Strategy Officer')
  })

  it('returns null for an unknown id', async () => {
    const agent = await getAgent('nonexistent-agent')
    expect(agent).toBeNull()
  })

  it('returns null for empty string', async () => {
    const agent = await getAgent('')
    expect(agent).toBeNull()
  })

  it('is case-sensitive (uppercase id returns null)', async () => {
    const agent = await getAgent('VERA')
    expect(agent).toBeNull()
  })

  it('returns agent with correct directReports', async () => {
    const jarvis = await getAgent('jarvis')
    expect(jarvis).not.toBeNull()
    expect(jarvis!.directReports).toContain('vera')
    expect(jarvis!.directReports).toContain('lumen')
    expect(jarvis!.directReports).toContain('pulse')
  })

  it('returns agent with correct reportsTo chain', async () => {
    const robin = await getAgent('robin')
    expect(robin).not.toBeNull()
    expect(robin!.reportsTo).toBe('vera')

    const vera = await getAgent('vera')
    expect(vera!.reportsTo).toBe('jarvis')

    const jarvis = await getAgent('jarvis')
    expect(jarvis!.reportsTo).toBeNull()
  })
})
