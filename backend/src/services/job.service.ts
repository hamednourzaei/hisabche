// ============================================
// backend/src/services/job.service.ts — Optimized v2.0
// ============================================

import { supabase } from "../db";
import type { CreateJobInput } from "@hisabche/validation";

// ✅ Column Selection Constants
const JOB_COLUMNS = 'id, job_type, status, payload, scheduled_at, max_retries, retry_count, last_error, started_at, completed_at, created_at'

export class JobService {
  async create(input: CreateJobInput) {
    const { data, error } = await supabase
      .from("background_jobs")
      .insert({
        job_type: input.job_type,
        payload: input.payload ?? {},
        scheduled_at: input.scheduled_at ?? new Date().toISOString(),
        max_retries: input.max_retries ?? 3,
      })
      .select(JOB_COLUMNS)
      .single();

    if (error) throw error;
    return data;
  }

  async fetchPending() {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("background_jobs")
      .select(JOB_COLUMNS)
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .order("scheduled_at")
      .limit(5);

    return data || [];
  }

  async markProcessing(id: string) {
    await supabase
      .from("background_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", id);
  }

  async markCompleted(id: string) {
    await supabase
      .from("background_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);
  }

  async markFailed(id: string, error: string) {
    await supabase
      .from("background_jobs")
      .update({ status: "failed", last_error: error, completed_at: new Date().toISOString() })
      .eq("id", id);
  }
}