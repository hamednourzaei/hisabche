// ============================================
// backend/src/db/circuit-breaker.ts
//
// Read-Replica & Standby Circuit Breaker
// Diverts traffic away from lagging or failing replicas to protect
// financial read consistency and prevent cascading query failures.
// ============================================

import type { CircuitBreakerConfig, CircuitBreakerState } from './runtime-types'

export class ReplicaCircuitBreaker {
  private state: CircuitBreakerState = 'closed'
  private consecutiveFailures = 0
  private consecutiveSuccesses = 0
  private lastStateChangeAt: number = Date.now()
  private readonly config: CircuitBreakerConfig

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 3,
      successThreshold: config?.successThreshold ?? 2,
      timeoutMs: config?.timeoutMs ?? 15_000,
    }
  }

  public getState(): CircuitBreakerState {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastStateChangeAt
      if (elapsed >= this.config.timeoutMs) {
        this.transitionTo('half-open')
      }
    }
    return this.state
  }

  public isAvailable(): boolean {
    const currentState = this.getState()
    return currentState === 'closed' || currentState === 'half-open'
  }

  public getFailureCount(): number {
    return this.consecutiveFailures
  }

  public recordSuccess(): void {
    if (this.state === 'half-open') {
      this.consecutiveSuccesses++
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.consecutiveFailures = 0
        this.consecutiveSuccesses = 0
        this.transitionTo('closed')
      }
    } else if (this.state === 'closed') {
      this.consecutiveFailures = 0
    }
  }

  public recordFailure(): void {
    this.consecutiveFailures++
    if (this.state === 'closed' && this.consecutiveFailures >= this.config.failureThreshold) {
      this.consecutiveSuccesses = 0
      this.transitionTo('open')
    } else if (this.state === 'half-open') {
      this.consecutiveSuccesses = 0
      this.transitionTo('open')
    }
  }

  public reset(): void {
    this.consecutiveFailures = 0
    this.consecutiveSuccesses = 0
    this.transitionTo('closed')
  }

  private transitionTo(newState: CircuitBreakerState): void {
    this.state = newState
    this.lastStateChangeAt = Date.now()
  }
}

export const replicaCircuitBreaker = new ReplicaCircuitBreaker()
