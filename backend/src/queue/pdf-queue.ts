// ============================================
// backend/src/queue/pdf-queue.ts
// FIXED: SHA-256 hash + private bucket + signed URL
// ============================================

import { Queue, Worker, Job } from "bullmq";
import { createHash } from "crypto";
import { renderToStream } from "@react-pdf/renderer";
import { createClient } from "@supabase/supabase-js";
import InvoicePDFDocument from "../pdf/InvoicePDFDocument";

// ─── Redis Connection ─────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const connection = { url: REDIS_URL };

// ─── Supabase Storage Client ──────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";
const storageClient = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "pdf-cache";
const SIGNED_URL_TTL_SECONDS = 3600;

// ─── Ensure bucket exists & is PRIVATE ────────────────
// ✅ FIX 1: همیشه private (نه public ❌)
// ✅ FIX 2: تبدیل getBucket().catch() به ensureBucket()
async function ensureBucket(): Promise<void> {
  const { data: buckets, error } = await storageClient.storage.listBuckets();

  if (error) {
    console.error("❌ Failed to list buckets:", error.message);
    return;
  }

  const exists = buckets?.some((b) => b.name === BUCKET_NAME);

  if (!exists) {
    console.log(`📦 Creating bucket: ${BUCKET_NAME} (private)`);
    const { error: createError } = await storageClient.storage.createBucket(
      BUCKET_NAME,
      { public: false }
    );

    if (createError) {
      console.error(
        `❌ Failed to create bucket: ${BUCKET_NAME}`,
        createError.message
      );
    } else {
      console.log(`✅ Bucket created: ${BUCKET_NAME} (private)`);
    }
    return;
  }

  // ✅ اگر باکت از قبل وجود داشت، اطمینان از private بودن
  const bucket = buckets?.find((b) => b.name === BUCKET_NAME);
  if (bucket?.public) {
    console.warn(
      `⚠️  Bucket ${BUCKET_NAME} is PUBLIC — updating to PRIVATE...`
    );
    const { error: updateError } = await storageClient.storage.updateBucket(
      BUCKET_NAME,
      { public: false }
    );
    if (updateError) {
      console.error(
        `❌ Failed to update bucket visibility:`,
        updateError.message
      );
    } else {
      console.log(`✅ Bucket ${BUCKET_NAME} is now PRIVATE`);
    }
  }
}

// ─── اجرای ensureBucket در startup ──────────────────
ensureBucket().catch((err) =>
  console.error("ensureBucket failed:", err)
);

// ─── Queue ────────────────────────────────────────────
export const pdfQueue = new Queue("pdf-generation", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

// ─── Job Data Type ────────────────────────────────────
interface PdfJobData {
  invoiceId: string;
  invoice: any;
}

// ─── Helper: Get cache path — SHA-256 (مثل invoice-pdf.routes.ts) ──
// ✅ FIX 3: یکسان‌سازی با invoice-pdf.routes.ts
// قبلاً: createHash('md5').update(JSON.stringify(invoiceId))
// الان:  createHash('sha256').update(`${invoiceId}:${versionKey}`)
function getCachePath(invoiceId: string, versionKey: string): string {
  const hash = createHash("sha256")
    .update(`${invoiceId}:${versionKey}`)
    .digest("hex");
  return `invoices/${hash}.pdf`;
}

// ─── Helper: Upload PDF to Storage ────────────────────
async function uploadToStorage(
  invoiceId: string,
  versionKey: string,
  buffer: Buffer
): Promise<string> {
  const path = getCachePath(invoiceId, versionKey);

  const { error } = await storageClient.storage
    .from(BUCKET_NAME)
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "86400",
    });

  if (error) throw error;

  // ✅ FIX 4: استفاده از signed URL (نه publicUrl)
  // چون باکت PRIVATE است
  const { data: urlData } = await storageClient.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (!urlData?.signedUrl) {
    throw new Error("Failed to generate signed URL");
  }

  return urlData.signedUrl;
}

// ─── Worker ───────────────────────────────────────────
const worker = new Worker<PdfJobData>(
  "pdf-generation",
  async (job: Job<PdfJobData>) => {
    const { invoiceId, invoice } = job.data;

    // ✅ versionKey برای هماهنگی با invoice-pdf.routes.ts
    const versionKey =
      invoice.updated_at || invoice.created_at || invoiceId;

    await job.updateProgress(10);

    // Generate PDF
    const stream = await renderToStream(
      InvoicePDFDocument({ invoice })
    );

    await job.updateProgress(50);

    // Collect chunks
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      );
    }

    await job.updateProgress(80);

    // Upload to Supabase Storage (private bucket → signed URL)
    const buffer = Buffer.concat(chunks);
    const signedUrl = await uploadToStorage(
      invoiceId,
      versionKey,
      buffer
    );

    await job.updateProgress(100);

    return {
      url: signedUrl,
      path: getCachePath(invoiceId, versionKey),
    };
  },
  {
    connection,
    concurrency: 3,
    autorun: true,
  }
);

// ─── Worker Events ────────────────────────────────────
worker.on("completed", (job) => {
  console.log(
    `✅ PDF job ${job.id} completed: ${job.returnvalue?.url}`
  );
});

worker.on("failed", (job, err) => {
  console.error(`❌ PDF job ${job?.id} failed:`, err.message);
});

// ─── Helper: Check if PDF exists in storage ───────────
// ✅ FIX 5: یکسان‌سازی با invoice-pdf.routes.ts
// قبلاً: createHash('md5').update(JSON.stringify(invoiceId))
// الان:  هماهنگ با getCachePath در invoice-pdf.routes.ts
export async function getCachedPdfUrl(
  invoiceId: string,
  versionKey: string
): Promise<string | null> {
  const path = getCachePath(invoiceId, versionKey);

  const { data, error } = await storageClient.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

// ─── Helper: Add job to queue ─────────────────────────
export async function enqueuePdfJob(
  invoiceId: string,
  invoice: any
): Promise<string> {
  const job = await pdfQueue.add(`pdf-${invoiceId}`, {
    invoiceId,
    invoice,
  });
  return job.id!;
}

// ─── Export worker reference for health checks ─────────
export { worker };