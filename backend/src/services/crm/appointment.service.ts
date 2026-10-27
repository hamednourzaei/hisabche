// ============================================
// backend/src/services/crm/appointment.service.ts
//
// Appointment Service (Option 26 / Service Businesses & Appointments)
// Lands in: Buyers -> Outreach (CRM)
// Checks for resource scheduling conflicts.
// Enforces workspace_id tenancy boundary on every query.
// ============================================

import { hasAppointmentConflict } from '@hisabche/validation'
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
    const existing = await this.getAppointments(workspaceId)
    const hasConflict = hasAppointmentConflict(
      existing.map((a) => ({
        id: a.id,
        customerId: a.customer_id,
        staffEmployeeId: a.staff_employee_id,
        serviceProductId: a.service_product_id,
        startTime: a.start_time,
        endTime: a.end_time,
        status: a.status,
      })),
      {
        startTime: input.startTime,
        endTime: input.endTime,
        staffEmployeeId: input.staffEmployeeId,
      },
    )

    if (hasConflict) {
      throw new Error('APPOINTMENT_CONFLICT')
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

    if (error) throw error
    return data
  }
}
