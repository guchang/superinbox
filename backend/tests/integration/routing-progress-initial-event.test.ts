import { describe, it, expect } from 'vitest'
import { buildRoutingProgressInitialEvent } from '../../src/capture/controllers/routing-progress-initial-event.js'

describe('buildRoutingProgressInitialEvent', () => {
  it('maps pending -> routing:pending', () => {
    const event = buildRoutingProgressInitialEvent({
      id: 'item-1',
      routingStatus: 'pending',
      distributedTargets: [],
      distributionResults: [],
    } as any)

    expect(event.type).toBe('routing:pending')
    expect(event.itemId).toBe('item-1')
    expect(typeof event.timestamp).toBe('string')
  })

  it('maps skipped -> routing:skipped', () => {
    const event = buildRoutingProgressInitialEvent({
      id: 'item-2',
      routingStatus: 'skipped',
      distributedTargets: [],
      distributionResults: [],
    } as any)

    expect(event.type).toBe('routing:skipped')
    expect(event.itemId).toBe('item-2')
  })

  it('maps processing -> routing:start', () => {
    const event = buildRoutingProgressInitialEvent({
      id: 'item-3',
      routingStatus: 'processing',
      distributedTargets: [],
      distributionResults: [],
    } as any)

    expect(event.type).toBe('routing:start')
    expect(event.itemId).toBe('item-3')
  })

  it('maps completed -> routing:complete (extracts ruleNames)', () => {
    const event = buildRoutingProgressInitialEvent({
      id: 'item-4',
      routingStatus: 'completed',
      distributedTargets: ['t1', 't2'],
      distributionResults: [
        { status: 'success', ruleName: 'Rule A' },
        { status: 'failed', ruleName: 'Rule B' },
        { status: 'success', ruleName: 'Rule C' },
        { status: 'success' },
      ],
    } as any)

    expect(event.type).toBe('routing:complete')
    if (event.type === 'routing:complete') {
      expect(event.data.distributedTargets).toEqual(['t1', 't2'])
      expect(event.data.ruleNames).toEqual(['Rule A', 'Rule C'])
      expect(event.data.totalSuccess).toBe(2)
      expect(event.data.totalFailed).toBe(1)
    }
  })

  it('maps failed -> routing:error', () => {
    const event = buildRoutingProgressInitialEvent({
      id: 'item-5',
      routingStatus: 'failed',
      distributedTargets: [],
      distributionResults: [],
    } as any)

    expect(event.type).toBe('routing:error')
    expect(event.itemId).toBe('item-5')
  })
})

