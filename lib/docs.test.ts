// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockExistsSync,
  mockStatSync,
  mockReaddirSync,
  mockReadFileSync,
  mockRequireEnv,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockStatSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockRequireEnv: vi.fn(),
}))

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  statSync: mockStatSync,
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync,
  default: {
    existsSync: mockExistsSync,
    statSync: mockStatSync,
    readdirSync: mockReaddirSync,
    readFileSync: mockReadFileSync,
  },
}))

vi.mock('@/lib/env', () => ({
  requireEnv: mockRequireEnv,
}))

import { getDocFiles, getDocContent, PathTraversalError } from './docs'

function makeStat(opts: { isFile?: boolean; isDir?: boolean; size?: number; mtime?: Date }) {
  return {
    isFile: () => opts.isFile ?? true,
    isDirectory: () => opts.isDir ?? false,
    size: opts.size ?? 100,
    mtime: opts.mtime ?? new Date('2025-01-15T10:00:00Z'),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireEnv.mockReturnValue('/workspace')
})

describe('getDocFiles', () => {
  it('returns empty array when workspace does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    expect(getDocFiles()).toEqual([])
  })

  it('discovers .md files at workspace root', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['report.md', 'notes.txt'])
    mockStatSync.mockReturnValue(makeStat({ isFile: true, size: 500 }))

    const files = getDocFiles()
    expect(files).toHaveLength(2)
    expect(files[0].name).toBe('report.md')
    expect(files[0].fileType).toBe('md')
    expect(files[0].category).toBe('root')
    expect(files[1].name).toBe('notes.txt')
    expect(files[1].fileType).toBe('txt')
  })

  it('skips SOUL.md and MEMORY.md', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['SOUL.md', 'MEMORY.md', 'report.md'])
    mockStatSync.mockReturnValue(makeStat({ isFile: true }))

    const files = getDocFiles()
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('report.md')
  })

  it('skips node_modules, .git, and memory directories', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/workspace') return ['node_modules', '.git', 'memory', 'doc.md']
      return []
    })
    mockStatSync.mockImplementation((path: string) => {
      if (path.endsWith('doc.md')) return makeStat({ isFile: true })
      return makeStat({ isDir: true })
    })

    const files = getDocFiles()
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('doc.md')
  })

  it('categorizes files in agents/ subdirectories', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/workspace') return ['agents']
      if (dir === '/workspace/agents') return ['vera']
      if (dir === '/workspace/agents/vera') return ['report.md', 'SOUL.md']
      return []
    })
    mockStatSync.mockImplementation((path: string) => {
      if (path.endsWith('.md')) return makeStat({ isFile: true })
      return makeStat({ isDir: true })
    })

    const files = getDocFiles()
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('report.md')
    expect(files[0].category).toBe('agent')
    expect(files[0].agentId).toBe('vera')
    expect(files[0].tags).toContain('vera')
    expect(files[0].relativePath).toBe('agents/vera/report.md')
  })

  it('categorizes files in docs/ subdirectories', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/workspace') return ['docs']
      if (dir === '/workspace/docs') return ['guide.md']
      return []
    })
    mockStatSync.mockImplementation((path: string) => {
      if (path.endsWith('.md')) return makeStat({ isFile: true })
      return makeStat({ isDir: true })
    })

    const files = getDocFiles()
    expect(files).toHaveLength(1)
    expect(files[0].category).toBe('docs')
  })

  it('categorizes files in output/ subdirectories', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/workspace') return ['output']
      if (dir === '/workspace/output') return ['data.csv']
      return []
    })
    mockStatSync.mockImplementation((path: string) => {
      if (path.endsWith('.csv')) return makeStat({ isFile: true })
      return makeStat({ isDir: true })
    })

    const files = getDocFiles()
    expect(files).toHaveLength(1)
    expect(files[0].category).toBe('output')
    expect(files[0].fileType).toBe('csv')
  })

  it('sorts by lastModified descending', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['old.md', 'new.md'])
    mockStatSync.mockImplementation((path: string) => {
      if ((path as string).endsWith('old.md')) return makeStat({ isFile: true, mtime: new Date('2024-01-01') })
      return makeStat({ isFile: true, mtime: new Date('2025-06-01') })
    })

    const files = getDocFiles()
    expect(files[0].name).toBe('new.md')
    expect(files[1].name).toBe('old.md')
  })

  it('generates correct tags', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['data.json'])
    mockStatSync.mockReturnValue(makeStat({ isFile: true }))

    const files = getDocFiles()
    expect(files[0].tags).toEqual(['json', 'root'])
  })

  it('handles unreadable directories gracefully', () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied')
    })

    const files = getDocFiles()
    expect(files).toEqual([])
  })
})

describe('getDocContent', () => {
  it('reads text file content', () => {
    mockExistsSync.mockReturnValue(true)
    mockStatSync.mockReturnValue(makeStat({ isFile: true, size: 42 }))
    mockReadFileSync.mockReturnValue('# Hello World')

    const result = getDocContent('report.md')
    expect(result).not.toBeNull()
    expect(result!.content).toBe('# Hello World')
    expect(result!.file.name).toBe('report.md')
    expect(result!.file.fileType).toBe('md')
  })

  it('returns empty content for binary files', () => {
    mockExistsSync.mockReturnValue(true)
    mockStatSync.mockReturnValue(makeStat({ isFile: true }))

    const result = getDocContent('report.pdf')
    expect(result).not.toBeNull()
    expect(result!.content).toBe('')
    expect(result!.file.fileType).toBe('pdf')
  })

  it('returns null for non-existent files', () => {
    mockExistsSync.mockReturnValue(false)
    expect(getDocContent('missing.md')).toBeNull()
  })

  it('throws PathTraversalError for .. in path', () => {
    expect(() => getDocContent('../etc/passwd')).toThrow(PathTraversalError)
  })

  it('throws PathTraversalError for paths escaping workspace', () => {
    mockExistsSync.mockReturnValue(true)
    expect(() => getDocContent('foo/../../etc/passwd')).toThrow(PathTraversalError)
  })
})
