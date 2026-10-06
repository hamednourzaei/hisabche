import { z } from 'zod'

export const AttendanceDeviceType = z.enum([
  'fingerprint',
  'face',
  'card',
  'fingerprint_card',
  'face_fingerprint_card',
  'multi_biometric',
  'mobile',
  'web',
])

export const AttendanceConnectionType = z.enum([
  'tcp_ip',
  'http',
  'https',
  'wifi',
  'usb',
  'rs485',
  'cloud_api',
  'sdk',
  'webhook',
])

export const AttendanceCredentialType = z.enum(['fingerprint', 'card', 'face', 'pin', 'qr'])

export const AttendanceEventType = z.enum([
  'check_in',
  'check_out',
  'break_start',
  'break_end',
  'meal_start',
  'meal_end',
  'overtime_start',
  'overtime_end',
  'unknown',
])

export const AttendanceVerificationMethod = z.enum([
  'fingerprint',
  'face',
  'palm',
  'rfid',
  'pin',
  'qr',
  'password',
  'manual',
  'mobile',
  'api',
  'unknown',
])

export const AttendanceDayStatus = z.enum([
  'present',
  'absent',
  'late',
  'half_day',
  'leave',
  'holiday',
  'off_day',
  'incomplete',
  'pending_review',
])

export const PunchEventSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  device_id: z.string().uuid().nullable(),
  external_user_id: z.string().nullable(),

  occurred_at: z.string().datetime(),
  occurred_at_utc: z.string().datetime(),
  device_timezone: z.string().nullable(),

  event_type: AttendanceEventType,
  verification_method: AttendanceVerificationMethod,
  verification_status: z.enum(['accepted', 'rejected']),

  device_event_id: z.string().nullable(),
  device_transaction_id: z.string().nullable(),
  work_code: z.string().nullable(),
  attendance_code: z.string().nullable(),

  source: z.enum(['device', 'mobile', 'web', 'admin', 'api']),
  raw_event_hash: z.string().nullable(),

  received_at: z.string().datetime(),
  processed_at: z.string().datetime().nullable(),
  sync_status: z.string(),

  created_at: z.string().datetime(),
})

export type PunchEvent = z.infer<typeof PunchEventSchema>

// The generic vendor adapter interface
export interface DeviceInfo {
  vendor: string
  model: string
  firmware: string
  serialNumber: string
}

export interface RawDeviceEvent {
  externalEventId: string
  payload: any
  eventType: string
  occurredAt: Date
}

export interface NormalizedPunchEvent {
  externalUserId: string
  occurredAt: Date
  deviceTimezone: string
  eventType: z.infer<typeof AttendanceEventType>
  verificationMethod: z.infer<typeof AttendanceVerificationMethod>
  verificationStatus: 'accepted' | 'rejected'
  workCode?: string
}

export interface AttendanceDeviceAdapter {
  connect(): Promise<boolean>
  testConnection(): Promise<boolean>
  getDeviceInfo(): Promise<DeviceInfo>

  pullEvents(cursor: string): Promise<{ events: RawDeviceEvent[]; nextCursor: string }>
  subscribeEvents?(callback: (event: RawDeviceEvent) => void): Promise<void>

  getUsers(): Promise<any[]>
  enrollUser(userId: string, credentialType: string): Promise<boolean>
  disableUser(userId: string): Promise<boolean>
  deleteUser(userId: string): Promise<boolean>

  getDeviceStatus(): Promise<any>

  // Normalization logic specific to the vendor payload
  normalizeEvent(rawEvent: RawDeviceEvent): NormalizedPunchEvent
}
