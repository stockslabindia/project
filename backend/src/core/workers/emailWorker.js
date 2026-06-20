/**
 * emailWorker.js
 * BullMQ worker — processes the email-queue.
 * Renders the correct HTML template and sends via Resend.
 */

const { Worker } = require('bullmq');
const { redisOpts } = require('../../redis/client');
const { sendEmail, getTemplateFn } = require('../../services/emailService');
const templates = require('../../services/emailTemplates');

let emailWorker = null;

function startEmailWorker() {
  emailWorker = new Worker(
    'email-queue',
    async (job) => {
      const { type, payload } = job.data;

      if (!payload?.to) {
        throw new Error(`Missing recipient 'to' address for email type: ${type}`);
      }

      // Get the template function for this type
      const templateFn = getTemplateFn(templates, type);
      if (!templateFn) {
        throw new Error(`Unknown email type: ${type}`);
      }

      // Render the HTML
      const { subject, html } = templateFn(payload);

      // Send via Resend
      const result = await sendEmail({
        to: payload.to,
        subject,
        html,
        userId: payload.userId || null,
        type,
        campaignId: payload.campaignId || null,
      });

      if (!result.success) {
        throw new Error(result.error || 'Email send failed');
      }

      return { emailId: result.id, to: payload.to, type };
    },
    {
      connection: redisOpts,
      concurrency: 5,          // Process up to 5 emails simultaneously
      limiter: {
        max: 10,               // Max 10 emails per second (Resend free tier safe)
        duration: 1000,
      },
    }
  );

  emailWorker.on('completed', (job, result) => {
    console.log(`[EmailWorker] ✅ [${result.type}] sent to ${result.to} (job: ${job.id})`);
  });

  emailWorker.on('failed', (job, err) => {
    console.error(`[EmailWorker] ❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
  });

  emailWorker.on('error', (err) => {
    console.error('[EmailWorker] Worker error:', err.message);
  });

  console.log('📧 Email Worker started and listening on email-queue');
  return emailWorker;
}

function stopEmailWorker() {
  if (emailWorker) {
    return emailWorker.close();
  }
}

module.exports = { startEmailWorker, stopEmailWorker };
