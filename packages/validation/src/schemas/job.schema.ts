import { z } from "zod";

export const jobStatusEnum = z.enum(["pending", "processing", "completed", "failed"]);

export const createJobSchema = z.object({
  job_type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  scheduled_at: z.string().optional(),
  max_retries: z.number().int().min(0).max(10).default(3),
});

export const jobSchema = createJobSchema.extend({
  id: z.string().uuid(),
  status: jobStatusEnum,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  last_error: z.string().nullable(),
  retry_count: z.number().int(),
  created_at: z.string(),
});

export type JobStatus = z.infer<typeof jobStatusEnum>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type Job = z.infer<typeof jobSchema>;