export type ServiceMode = 'normal' | 'read_only' | 'degraded'

export interface ServiceModeInput {
  primaryWritable: boolean
  replicaLagExceeded: boolean
  underPressure: boolean
}

export interface ServiceModeState {
  mode: ServiceMode
  primaryWritable: boolean
  replicaLagExceeded: boolean
  underPressure: boolean
  updatedAt: string
}

let currentState: ServiceModeState = {
  mode: 'normal',
  primaryWritable: true,
  replicaLagExceeded: false,
  underPressure: false,
  updatedAt: new Date().toISOString(),
}

export function deriveServiceMode(input: ServiceModeInput): ServiceMode {
  if (!input.primaryWritable) return 'read_only'
  if (input.replicaLagExceeded || input.underPressure) return 'degraded'
  return 'normal'
}

export function setServiceModeInput(patch: Partial<ServiceModeInput>): ServiceModeState {
  const merged: ServiceModeInput = {
    primaryWritable: patch.primaryWritable ?? currentState.primaryWritable,
    replicaLagExceeded: patch.replicaLagExceeded ?? currentState.replicaLagExceeded,
    underPressure: patch.underPressure ?? currentState.underPressure,
  }
  currentState = {
    ...merged,
    mode: deriveServiceMode(merged),
    updatedAt: new Date().toISOString(),
  }
  return currentState
}

export function getServiceModeState(): ServiceModeState {
  return currentState
}

export function isWriteBlocked(): boolean {
  return currentState.mode === 'read_only'
}
