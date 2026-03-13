import { describe, expect, it } from 'vitest'
import { getFailedWorkUpdates } from './useAgentWork'

describe('getFailedWorkUpdates', () => {
  it('returns failed work to todo so tickets do not stay stuck in progress', () => {
    expect(getFailedWorkUpdates('Agent runtime did not return a response.')).toEqual({
      status: 'todo',
      workState: 'failed',
      workStartedAt: null,
      workError: 'Agent runtime did not return a response.',
    })
  })

  it('falls back to a generic message when the error is empty', () => {
    expect(getFailedWorkUpdates('')).toEqual({
      status: 'todo',
      workState: 'failed',
      workStartedAt: null,
      workError: 'Agent work failed',
    })
  })
})
