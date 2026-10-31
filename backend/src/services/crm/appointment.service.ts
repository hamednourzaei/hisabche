// ============================================
// backend/src/services/crm/appointment.service.ts
//
// Appointment Service (Option 26 / Service Businesses & Appointments)
// Lands in: Buyers -> Outreach (CRM)
// Checks for resource scheduling conflicts.
// Enforces workspace_id tenancy boundary on every query.
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../db'

export class AppointmentService {
  constructor(private readonly db: SupabaseClient = supabase) {}

  async getAppointments(workspaceId: string) {
    const { data, error } = await this.db
      .from('appointments')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('start_time', { ascending: true })

    if (error) throw error
    return data ?? []
  }

  async createAppointment(
    workspaceId: string,
    input: {
      customerId: string
      staffEmployeeId: string
      serviceProductId: string
      startTime: string
      endTime: string
      notes?: string | undefined
    },
  ) {
    // Check conflicts directly in SQL for the assigned staff member and time window
    const { data: conflicts, error: conflictErr } = await this.db
      .from('appointments')
      .select('id, staff_employee_id, start_time, end_time, status')
      .eq('workspace_id', workspaceId)
      .eq('staff_employee_id', input.staffEmployeeId)
      .neq('status', 'cancelled')
      .lt('start_time', input.endTime)
      .gt('end_time', input.startTime)

    if (conflictErr) throw conflictErr

    if (conflicts && conflicts.length > 0) {
      const err = new Error(
        'APPOINTMENT_CONFLICT: Selected staff member is already booked during this time window.',
      )
      ;(err as { code?: string }).code = 'APPOINTMENT_CONFLICT'
      throw err
    }

    const { data, error } = await this.db
      .from('appointments')
      .insert({
        workspace_id: workspaceId,
        customer_id: input.customerId,
        staff_employee_id: input.staffEmployeeId,
        service_product_id: input.serviceProductId,
        start_time: input.startTime,
        end_time: input.endTime,
        status: 'scheduled',
        notes: input.notes ?? null,
      })
      .select()
      .single()

    // 23P01 = exclusion_violation: a concurrent booking took the window between the
    // check above and this insert (docs/appointment-conflict-02-migration.sql).
    if ((error as { code?: string } | null)?.code === '23P01') {
      const clash = new Error(
        'APPOINTMENT_CONFLICT: Selected staff member is already booked during this time window.',
      )
      ;(clash as { code?: string }).code = 'APPOINTMENT_CONFLICT'
      throw clash
    }
    if (error) throw error
    return data
  }
}
