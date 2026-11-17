import { z } from 'zod'

export const CrmAppointmentInputSchema = z
  .object({
    customerId: z.string().uuid({ message: 'Invalid customer ID' }),
    staffEmployeeId: z.string().uuid({ message: 'Invalid staff employee ID' }),
    serviceProductId: z.string().uuid({ message: 'Invalid service product ID' }),
    startTime: z.string().datetime({ message: 'Start time must be a valid ISO 8601 datetime' }),
    endTime: z.string().datetime({ message: 'End time must be a valid ISO 8601 datetime' }),
    notes: z.string().max(1000).optional(),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: 'End time must be strictly after start time',
    path: ['endTime'],
  })

export type CrmAppointmentInput = z.infer<typeof CrmAppointmentInputSchema>
