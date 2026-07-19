// ============================================
// backend/src/services/job.service.ts — Optimized v2.2
// FIXED: TypeScript types for job object
// ============================================

import { supabase } from "../db";
import type { CreateJobInput } from "@hisabche/validation";
import { memoryCache } from "../utils/pagination";

// ✅ Types
export interface Job {
  id: string
  job_type: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  payload: Record<string, any>
  scheduled_at: string
  max_retries: number
  retry_count: number
  last_error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface JobMinimal {
  id: string
  job_type: string
  status: string
  scheduled_at: string
  created_at: string
}

// ✅ Column Selection Constants
const JOB_COLUMNS = 'id, job_type, status, payload, scheduled_at, max_retries, retry_count, last_error, started_at, completed_at, created_at'
const JOB_MINIMAL_COLUMNS = 'id, job_type, status, scheduled_at, created_at'

export class JobService {

  // ─── Cache Keys ──────────────────────────────────────────────
  private getPendingCacheKey() {
    return `jobs:pending`
  }

  private getStatsCacheKey() {
    return `jobs:stats`
  }

  private getJobCacheKey(id: string) {
    return `job:${id}`
  }

  // ─── Create Job ──────────────────────────────────────────────
  async create(input: CreateJobInput): Promise<Job> {
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

    await memoryCache.invalidate(this.getPendingCacheKey())
    await memoryCache.invalidate(this.getStatsCacheKey())

    return data as Job;
  }

  // ─── Fetch Pending Jobs ──────────────────────────────────────
  async fetchPending(limit: number = 5): Promise<JobMinimal[]> {
    const cacheKey = this.getPendingCacheKey()
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as JobMinimal[]

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("background_jobs")
      .select(JOB_MINIMAL_COLUMNS)
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(Math.min(limit, 20));

    if (error) {
      console.error('Failed to fetch pending jobs:', error)
      return []
    }

    const result = (data || []) as JobMinimal[]
    await memoryCache.set(cacheKey, result, 10)
    return result
  }

  // ─── Fetch Pending Jobs with Count ──────────────────────────
  async fetchPendingWithCount(limit: number = 5): Promise<{ jobs: JobMinimal[]; total: number }> {
    const now = new Date().toISOString();
    
    const [jobsResult, countResult] = await Promise.all([
      supabase
        .from("background_jobs")
        .select(JOB_MINIMAL_COLUMNS)
        .eq("status", "pending")
        .lte("scheduled_at", now)
        .order("scheduled_at", { ascending: true })
        .limit(Math.min(limit, 20)),
      supabase
        .from("background_jobs")
        .select("id", { count: "estimated", head: true })
        .eq("status", "pending")
        .lte("scheduled_at", now),
    ]);

    return {
      jobs: (jobsResult.data || []) as JobMinimal[],
      total: countResult.count || 0,
    }
  }

  // ─── Mark Job as Processing ──────────────────────────────────
  async markProcessing(id: string): Promise<JobMinimal | null> {
    const { data, error } = await supabase
      .from("background_jobs")
      .update({ 
        status: "processing", 
        started_at: new Date().toISOString() 
      })
      .eq("id", id)
      .select(JOB_MINIMAL_COLUMNS)
      .single();

    if (error) {
      console.error(`Failed to mark job ${id} as processing:`, error)
      return null
    }

    await memoryCache.invalidate(this.getPendingCacheKey())
    await memoryCache.invalidate(this.getStatsCacheKey())
    await memoryCache.invalidate(this.getJobCacheKey(id))

    return data as JobMinimal
  }

  // ─── Mark Job as Completed ──────────────────────────────────
  async markCompleted(id: string): Promise<JobMinimal | null> {
    const { data, error } = await supabase
      .from("background_jobs")
      .update({ 
        status: "completed", 
        completed_at: new Date().toISOString() 
      })
      .eq("id", id)
      .select(JOB_MINIMAL_COLUMNS)
      .single();

    if (error) {
      console.error(`Failed to mark job ${id} as completed:`, error)
      return null
    }

    await memoryCache.invalidate(this.getPendingCacheKey())
    await memoryCache.invalidate(this.getStatsCacheKey())
    await memoryCache.invalidate(this.getJobCacheKey(id))

    return data as JobMinimal
  }

  // ─── Mark Job as Failed ─────────────────────────────────────
  async markFailed(id: string, errorMessage: string): Promise<JobMinimal | null> {
    const { data, error } = await supabase
      .from("background_jobs")
      .update({ 
        status: "failed", 
        last_error: errorMessage, 
        completed_at: new Date().toISOString() 
      })
      .eq("id", id)
      .select(JOB_MINIMAL_COLUMNS)
      .single();

    if (error) {
      console.error(`Failed to mark job ${id} as failed:`, error)
      return null
    }

    await memoryCache.invalidate(this.getPendingCacheKey())
    await memoryCache.invalidate(this.getStatsCacheKey())
    await memoryCache.invalidate(this.getJobCacheKey(id))

    return data as JobMinimal
  }

  // ─── Get Job by ID ──────────────────────────────────────────
  async getJob(id: string): Promise<Job | null> {
    const cacheKey = this.getJobCacheKey(id)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as Job

    const { data, error } = await supabase
      .from("background_jobs")
      .select(JOB_COLUMNS)
      .eq("id", id)
      .single();

    if (error) {
      console.error(`Failed to fetch job ${id}:`, error)
      return null
    }

    if (data) {
      await memoryCache.set(cacheKey, data, 60)
      return data as Job
    }

    return null
  }

  // ─── Get Jobs by Status ─────────────────────────────────────
  async getJobsByStatus(status: 'pending' | 'processing' | 'completed' | 'failed', limit: number = 50): Promise<JobMinimal[]> {
    const cacheKey = `jobs:status:${status}:${limit}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as JobMinimal[]

    const { data, error } = await supabase
      .from("background_jobs")
      .select(JOB_MINIMAL_COLUMNS)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 100));

    if (error) {
      console.error(`Failed to fetch jobs with status ${status}:`, error)
      return []
    }

    const result = (data || []) as JobMinimal[]
    await memoryCache.set(cacheKey, result, 30)
    return result
  }

  // ─── Get Stats ──────────────────────────────────────────────
  async getStats(): Promise<{
    pending: number
    processing: number
    completed: number
    failed: number
    total: number
  }> {
    const cacheKey = this.getStatsCacheKey()
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as any

    const [pendingResult, processingResult, completedResult, failedResult] = await Promise.all([
      supabase.from("background_jobs").select("id", { count: "estimated", head: true }).eq("status", "pending"),
      supabase.from("background_jobs").select("id", { count: "estimated", head: true }).eq("status", "processing"),
      supabase.from("background_jobs").select("id", { count: "estimated", head: true }).eq("status", "completed"),
      supabase.from("background_jobs").select("id", { count: "estimated", head: true }).eq("status", "failed"),
    ]);

    const result = {
      pending: pendingResult.count || 0,
      processing: processingResult.count || 0,
      completed: completedResult.count || 0,
      failed: failedResult.count || 0,
      total: (pendingResult.count || 0) + (processingResult.count || 0) + 
             (completedResult.count || 0) + (failedResult.count || 0),
    }

    await memoryCache.set(cacheKey, result, 10)
    return result
  }

  // ─── Retry Failed Job ──────────────────────────────────────
  async retryJob(id: string): Promise<JobMinimal | null> {
    // ✅ با تایپ مشخص
    const job = await this.getJob(id)
    if (!job) return null

    // ✅ فقط jobs با status 'failed' قابل retry هستند
    if (job.status !== 'failed') {
      console.log(`Job ${id} is not failed (status: ${job.status}), cannot retry`)
      return null
    }

    // ✅ بررسی max_retries
    const currentRetryCount = job.retry_count || 0
    if (currentRetryCount >= job.max_retries) {
      console.log(`Job ${id} has reached max retries (${job.max_retries})`)
      return null
    }

    // ✅ به‌روزرسانی status به pending با retry_count + 1
    const { data, error } = await supabase
      .from("background_jobs")
      .update({ 
        status: "pending",
        retry_count: currentRetryCount + 1,
        last_error: null,
        scheduled_at: new Date(Date.now() + 5000).toISOString(),
      })
      .eq("id", id)
      .select(JOB_MINIMAL_COLUMNS)
      .single();

    if (error) {
      console.error(`Failed to retry job ${id}:`, error)
      return null
    }

    await memoryCache.invalidate(this.getPendingCacheKey())
    await memoryCache.invalidate(this.getStatsCacheKey())
    await memoryCache.invalidate(this.getJobCacheKey(id))

    return data as JobMinimal
  }

  // ─── Cleanup Old Jobs ──────────────────────────────────────
  async cleanupOldJobs(daysToKeep: number = 30): Promise<{ deleted: number }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const { data, error } = await supabase
      .from("background_jobs")
      .delete()
      .eq("status", "completed")
      .lt("completed_at", cutoffDate.toISOString())
      .select("id")

    if (error) {
      console.error('Failed to cleanup old jobs:', error)
      return { deleted: 0 }
    }

    await memoryCache.invalidate(this.getStatsCacheKey())

    return { deleted: data?.length || 0 }
  }

  // ─── Invalidate All Cache ──────────────────────────────────
  async invalidateCache(): Promise<void> {
    await memoryCache.invalidate(this.getPendingCacheKey())
    await memoryCache.invalidate(this.getStatsCacheKey())
    await memoryCache.invalidate('job:*')
    await memoryCache.invalidate('jobs:status:*')
  }
}

export default JobService