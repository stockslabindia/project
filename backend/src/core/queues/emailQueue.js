/**
 * emailQueue.js
 * BullMQ email queue — same pattern as orderQueue.js
 * All email jobs flow through here for async, retried processing.
 */

const { Queue, QueueEvents } = require('bullmq');
const { redisOpts } = require('../../redis/client');
const { supabaseAdmin } = require('../../config/supabase');

// ── Email Queue ──
const emailQueue = new Queue('email-queue', {
  connection: redisOpts,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

emailQueue.on('error', (err) => {
  console.error('[EmailQueue] Queue error:', err.message);
});

// ── Queue Events (monitoring) ──
const emailQueueEvents = new QueueEvents('email-queue', { connection: redisOpts });

emailQueueEvents.on('failed', async ({ jobId, failedReason }) => {
  try {
    const job = await emailQueue.getJob(jobId);
    if (!job) return;

    const isExhausted = job.attemptsMade >= (job.opts?.attempts || 3);
    if (!isExhausted) return;

    console.error(`[EmailQueue] 💀 Job [${jobId}] permanently failed: ${failedReason}`);

    await supabaseAdmin.from('audit_logs').insert({
      action: 'email_job_failed',
      description: `Email BullMQ job ${jobId} permanently failed: ${failedReason?.slice(0, 200)}`,
      target_type: 'email',
      target_id: jobId,
      metadata: {
        type: job.data?.type,
        to: job.data?.payload?.to,
        attempts: job.attemptsMade,
      },
    });
  } catch (err) {
    console.error('[EmailQueue] Dead-letter handler error:', err.message);
  }
});

/**
 * Add an email job to the queue.
 * @param {string} type     - Email type: 'welcome', 'deposit_approved', etc.
 * @param {object} payload  - Data for the template (must include .to email address)
 * @param {object} [opts]   - Optional BullMQ job options (priority, delay, etc.)
 */
async function enqueueEmail(type, payload, opts = {}) {
  const job = await emailQueue.add(
    `email:${type}`,
    { type, payload },
    {
      priority: opts.priority || 10,
      ...opts,
    }
  );
  console.log(`[EmailQueue] 📧 Queued [${type}] for ${payload.to} — job: ${job.id}`);
  return job;
}

module.exports = { emailQueue, emailQueueEvents, enqueueEmail };
