-- ==============================================================================
-- HISABCHE: ATTENDANCE & WORKFORCE PLATFORM MIGRATION
-- Core schema for integrating biometric devices, workforce scheduling, 
-- time tracking, and leave management.
-- ==============================================================================

-- ==============================================================================
-- 1. ENUMS
-- ==============================================================================

CREATE TYPE attendance_device_type AS ENUM (
  'fingerprint', 'face', 'card', 'fingerprint_card', 'face_fingerprint_card', 'multi_biometric', 'mobile', 'web'
);

CREATE TYPE attendance_connection_type AS ENUM (
  'tcp_ip', 'http', 'https', 'wifi', 'usb', 'rs485', 'cloud_api', 'sdk', 'webhook'
);

CREATE TYPE attendance_credential_type AS ENUM (
  'fingerprint', 'card', 'face', 'pin', 'qr'
);

CREATE TYPE attendance_event_type AS ENUM (
  'check_in', 'check_out', 'break_start', 'break_end', 'meal_start', 'meal_end', 'overtime_start', 'overtime_end', 'unknown'
);

CREATE TYPE attendance_verification_method AS ENUM (
  'fingerprint', 'face', 'palm', 'rfid', 'pin', 'qr', 'password', 'manual', 'mobile', 'api', 'unknown'
);

CREATE TYPE attendance_day_status AS ENUM (
  'present', 'absent', 'late', 'half_day', 'leave', 'holiday', 'off_day', 'incomplete', 'pending_review'
);

-- ==============================================================================
-- 2. DEVICES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS attendance_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  code TEXT,
  vendor TEXT,
  model TEXT,
  serial_number TEXT,
  firmware_version TEXT,
  device_type attendance_device_type NOT NULL,
  
  -- Supported capabilities
  supports_fingerprint BOOLEAN DEFAULT false,
  supports_face BOOLEAN DEFAULT false,
  supports_card BOOLEAN DEFAULT false,
  supports_pin BOOLEAN DEFAULT false,
  supports_qr BOOLEAN DEFAULT false,
  
  -- Capacities
  capacity_users INTEGER,
  capacity_fingerprints INTEGER,
  capacity_cards INTEGER,
  capacity_transactions INTEGER,
  
  -- State
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'offline', 'error')),
  last_seen_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_cursor TEXT,
  
  configuration JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_device_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES attendance_devices(id) ON DELETE CASCADE,
  connection_type attendance_connection_type NOT NULL,
  host TEXT,
  port INTEGER,
  username TEXT,
  credential_reference TEXT, -- stored securely elsewhere or encrypted
  tls_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  webhook_secret_reference TEXT,
  
  last_connection_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  connection_status TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_device_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES attendance_devices(id) ON DELETE CASCADE,
  cursor TEXT,
  last_event_id TEXT,
  last_event_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  status TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  last_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_id)
);

-- ==============================================================================
-- 3. CREDENTIALS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS attendance_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  employee_id UUID NOT NULL REFERENCES employees(id), -- Assuming HR table
  device_id UUID REFERENCES attendance_devices(id),
  
  credential_type attendance_credential_type NOT NULL,
  external_user_id TEXT,
  credential_identifier TEXT, -- RFID card number, etc.
  finger_index TEXT, -- e.g., 'right_index'
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  enrolled_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. PUNCH EVENTS (The Core of Attendance)
-- ==============================================================================

-- Raw events keep the exact payload sent by the vendor
CREATE TABLE IF NOT EXISTS attendance_device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  device_id UUID REFERENCES attendance_devices(id),
  external_event_id TEXT,
  
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  event_type TEXT,
  
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  occurred_at TIMESTAMPTZ,
  
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'failed', 'ignored')),
  processing_error TEXT,
  processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Canonical append-only punch events
CREATE TABLE IF NOT EXISTS attendance_punch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  device_id UUID REFERENCES attendance_devices(id),
  external_user_id TEXT,
  
  occurred_at TIMESTAMPTZ NOT NULL,
  occurred_at_utc TIMESTAMPTZ NOT NULL,
  device_timezone TEXT,
  
  event_type attendance_event_type NOT NULL,
  verification_method attendance_verification_method NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'accepted' CHECK (verification_status IN ('accepted', 'rejected')),
  
  device_event_id TEXT,
  device_transaction_id TEXT,
  work_code TEXT,
  attendance_code TEXT,
  
  source TEXT NOT NULL CHECK (source IN ('device', 'mobile', 'web', 'admin', 'api')),
  raw_event_hash TEXT,
  
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'synced',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 5. SHIFTS & SCHEDULES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS attendance_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  code TEXT,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  grace_minutes INTEGER DEFAULT 0,
  late_after_minutes INTEGER DEFAULT 0,
  early_leave_after_minutes INTEGER DEFAULT 0,
  break_policy JSONB DEFAULT '{}',
  
  overtime_enabled BOOLEAN DEFAULT false,
  overtime_after_minutes INTEGER DEFAULT 0,
  cross_midnight BOOLEAN DEFAULT false,
  timezone TEXT,
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  shift_id UUID NOT NULL REFERENCES attendance_shifts(id),
  
  effective_from DATE NOT NULL,
  effective_to DATE,
  days_of_week JSONB NOT NULL, -- e.g., [0, 1, 2, 3, 4] for Sun-Thu
  timezone TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 6. ATTENDANCE SESSIONS & DAYS (Calculated)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS attendance_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  
  date DATE NOT NULL,
  timezone TEXT NOT NULL,
  
  first_in_at TIMESTAMPTZ,
  last_out_at TIMESTAMPTZ,
  
  worked_minutes INTEGER DEFAULT 0,
  break_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  late_minutes INTEGER DEFAULT 0,
  early_leave_minutes INTEGER DEFAULT 0,
  scheduled_minutes INTEGER DEFAULT 0,
  
  attendance_status attendance_day_status NOT NULL,
  
  calculation_version INTEGER DEFAULT 1,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_day_id UUID NOT NULL REFERENCES attendance_days(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  
  check_in_event_id UUID REFERENCES attendance_punch_events(id),
  check_out_event_id UUID REFERENCES attendance_punch_events(id),
  
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  worked_minutes INTEGER DEFAULT 0,
  
  status TEXT NOT NULL CHECK (status IN ('open', 'completed', 'incomplete', 'corrected')),
  source TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 7. CALENDARS & LEAVES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS attendance_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_calendar_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES attendance_calendars(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_type TEXT NOT NULL CHECK (day_type IN ('working_day', 'holiday', 'weekend', 'company_holiday')),
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (calendar_id, date)
);

CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  code TEXT,
  unit TEXT NOT NULL CHECK (unit IN ('minutes', 'hours', 'days')),
  paid BOOLEAN DEFAULT false,
  requires_approval BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 8. ADJUSTMENTS & CORRECTIONS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS attendance_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  attendance_day_id UUID REFERENCES attendance_days(id),
  target_event_id UUID REFERENCES attendance_punch_events(id),
  
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('add_punch', 'remove_punch', 'change_time', 'change_type', 'mark_absent', 'mark_present')),
  old_value JSONB,
  new_value JSONB NOT NULL,
  
  reason TEXT,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for all tables
ALTER TABLE attendance_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_device_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_device_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_device_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_punch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_calendar_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_adjustments ENABLE ROW LEVEL SECURITY;
