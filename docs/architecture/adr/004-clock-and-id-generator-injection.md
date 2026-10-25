# ADR-004: Clock and IdGenerator Injection for Pure Domain Rules

## Status

Accepted

## Context

Pure business rules, accounting calculations, and event generation must be 100% deterministic:

1. Re-running the same command on the same snapshot must always produce the exact same events and derived state.
2. In-flight unit testing, property testing, and golden-vector verification require freezing time and controlling generated IDs.
3. If domain rules call global non-deterministic functions directly (`Date.now()`, `new Date()`, `Math.random()`, `crypto.randomUUID()`), event hashing, replay verification, and server-side re-verification fail to achieve byte-for-byte reproducibility.

## Decision

1. **Explicit Port Interfaces in `packages/validation`**:
   Define lightweight, dependency-free port interfaces in `packages/validation/src/schemas/domain-ports.ts`:
   ```typescript
   export interface Clock {
     now(): Date
     nowIso(): string
   }

   export interface IdGenerator {
     generate(prefix?: string): string
   }
   ```
2. **Default System Implementations**:
   Provide standard system implementations for production runtime:
   ```typescript
   export const systemClock: Clock = {
     now: () => new Date(),
     nowIso: () => new Date().toISOString(),
   }

   export const defaultIdGenerator: IdGenerator = {
     generate: (prefix?: string) => {
       const uuid =
         typeof crypto !== 'undefined' && crypto.randomUUID
           ? crypto.randomUUID()
           : 'id-' + Math.random().toString(36).substring(2, 15)
       return prefix ? `${prefix}_${uuid}` : uuid
     },
   }
   ```
3. **Deterministic Mock Implementations for Tests & Event Replay**:
   ```typescript
   export class FixedClock implements Clock {
     constructor(private fixedIso: string) {}
     now() {
       return new Date(this.fixedIso)
     }
     nowIso() {
       return this.fixedIso
     }
   }

   export class SequenceIdGenerator implements IdGenerator {
     private counter = 0
     constructor(private prefix = 'id') {}
     generate() {
       return `${this.prefix}_${++this.counter}`
     }
   }
   ```
4. **Command & Calculation Signatures**:
   All pure rule functions accepting or requiring timestamps/IDs accept optional `Clock` and `IdGenerator` dependencies (defaulting to system implementations when omitted in live UI code, but explicitly injected in tests, replays, and sync re-verification).
5. **No Locale / Intl inside Rules**:
   Domain rules operate purely on numbers and ISO date strings (`YYYY-MM-DD`). Formatting and locale conversion remain strictly in `@hisabche/formatting`.

## Consequences

- Golden vectors and fast-check property tests can execute repeatedly with byte-for-byte identical output.
- Server re-verification of synced client events uses the event's recorded `clientTimestamp` and `idempotencyKey`, ensuring fair and reproducible derivation.
