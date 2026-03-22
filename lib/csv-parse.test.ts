import { describe, it, expect } from 'vitest'
import { parseCsv } from './csv-parse'

describe('parseCsv', () => {
  it('parses basic CSV with headers and rows', () => {
    const result = parseCsv('name,age,city\nAlice,30,NYC\nBob,25,LA')
    expect(result.headers).toEqual(['name', 'age', 'city'])
    expect(result.rows).toEqual([
      ['Alice', '30', 'NYC'],
      ['Bob', '25', 'LA'],
    ])
  })

  it('handles quoted fields with commas', () => {
    const result = parseCsv('name,description\nAlice,"likes cats, dogs"\nBob,"none"')
    expect(result.rows[0]).toEqual(['Alice', 'likes cats, dogs'])
    expect(result.rows[1]).toEqual(['Bob', 'none'])
  })

  it('handles escaped quotes inside quoted fields', () => {
    const result = parseCsv('name,quote\nAlice,"She said ""hello"""\nBob,"ok"')
    expect(result.rows[0]).toEqual(['Alice', 'She said "hello"'])
  })

  it('handles CRLF line endings', () => {
    const result = parseCsv('a,b\r\n1,2\r\n3,4')
    expect(result.headers).toEqual(['a', 'b'])
    expect(result.rows).toEqual([['1', '2'], ['3', '4']])
  })

  it('handles empty cells', () => {
    const result = parseCsv('a,b,c\n,2,\n1,,3')
    expect(result.rows[0]).toEqual(['', '2', ''])
    expect(result.rows[1]).toEqual(['1', '', '3'])
  })

  it('handles single column', () => {
    const result = parseCsv('name\nAlice\nBob')
    expect(result.headers).toEqual(['name'])
    expect(result.rows).toEqual([['Alice'], ['Bob']])
  })

  it('returns empty for blank input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] })
    expect(parseCsv('   ')).toEqual({ headers: [], rows: [] })
  })

  it('handles header-only CSV', () => {
    const result = parseCsv('a,b,c')
    expect(result.headers).toEqual(['a', 'b', 'c'])
    expect(result.rows).toEqual([])
  })

  it('handles quoted fields with newlines', () => {
    const result = parseCsv('name,bio\nAlice,"line1\nline2"\nBob,ok')
    expect(result.rows[0]).toEqual(['Alice', 'line1\nline2'])
    expect(result.rows[1]).toEqual(['Bob', 'ok'])
  })
})
