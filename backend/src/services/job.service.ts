import { supabase } from "../db";
import type { CreateJobInput } from "@hisabche/validation";

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
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async fetchPending() {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("background_jobs")
      .select("*")
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