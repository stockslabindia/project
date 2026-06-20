/**
 * emailService.js
 * Core email sending engine using the Resend SDK.
 * All emails are logged to the email_logs Supabase table.
 */

const { Resend } = require('resend');
const { supabaseAdmin } = require('../config/supabase');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const EMAIL_FROM = process.env.EMAIL_FROM || 'StocksLab India <noreply@stockslab.live>';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@stockslab.live';

/**
 * Send a single email immediately via Resend.
 * Logs the result to email_logs table.
 *
 * @param {object} opts
 * @param {string}   opts.to          - Recipient email address
 * @param {string}   opts.subject     - Email subject
 * @param {string}   opts.html        - HTML body
 * @param {string}   [opts.text]      - Plain-text fallback (optional)
 * @param {string}   [opts.userId]    - Supabase user ID for logging
 * @param {string}   [opts.type]      - Email type for logging (e.g. 'welcome')
 * @param {string}   [opts.campaignId] - bulk_email_campaigns.id if applicable
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
async function sendEmail({ to, subject, html, text, userId = null, type = 'transactional', campaignId = null }) {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set — email skipped:', type, to);
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  let status = 'sent';
  let errorMessage = null;
  let emailId = null;

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      reply_to: EMAIL_REPLY_TO,
    });

    if (result.error) {
      status = 'failed';
      errorMessage = result.error.message || JSON.stringify(result.error);
      console.error(`[Email] Failed to send [${type}] to ${to}:`, errorMessage);
    } else {
      emailId = result.data?.id;
      console.log(`[Email] ✅ Sent [${type}] to ${to} — Resend ID: ${emailId}`);
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err.message;
    console.error(`[Email] Exception sending [${type}] to ${to}:`, err.message);
  }

  // Log to email_logs (non-blocking — don't let logging failure break the flow)
  supabaseAdmin.from('email_logs').insert({
    user_id: userId || null,
    email_to: to,
    type,
    subject,
    status,
    error_message: errorMessage,
    campaign_id: campaignId || null,
    sent_at: new Date().toISOString(),
  }).then(({ error: logErr }) => {
    if (logErr) console.warn('[Email] Could not write to email_logs:', logErr.message);
  });

  return { success: status === 'sent', id: emailId, error: errorMessage };
}

/**
 * Queue an email via BullMQ for async, retried delivery.
 * Preferred method for route handlers (non-blocking).
 *
 * @param {string} type    - Email type key (e.g. 'welcome', 'deposit_approved')
 * @param {object} payload - Data passed to the email template
 * @param {object} [opts]  - Optional BullMQ job options
 */
async function queueEmail(type, payload, opts = {}) {
  try {
    const { enqueueEmail } = require('../core/queues/emailQueue');
    await enqueueEmail(type, payload, opts);
  } catch (err) {
    console.error('[Email] Failed to enqueue email:', type, err.message);
    // Fallback: attempt direct send so the email still goes out
    try {
      const templates = require('./emailTemplates');
      const templateFn = getTemplateFn(templates, type);
      if (templateFn) {
        const { subject, html } = templateFn(payload);
        await sendEmail({ to: payload.to, subject, html, userId: payload.userId, type });
      }
    } catch (fallbackErr) {
      console.error('[Email] Fallback send also failed:', fallbackErr.message);
    }
  }
}

/** Map email type string to its template function */
function getTemplateFn(templates, type) {
  const map = {
    welcome:               templates.welcomeEmail,
    bank_account_added:    templates.bankAccountAddedEmail,
    bank_account_removed:  templates.bankAccountRemovedEmail,
    deposit_approved:      templates.depositApprovedEmail,
    deposit_rejected:      templates.depositRejectedEmail,
    withdrawal_approved:   templates.withdrawalApprovedEmail,
    withdrawal_rejected:   templates.withdrawalRejectedEmail,
    kyc_approved:          templates.kycApprovedEmail,
    kyc_rejected:          templates.kycRejectedEmail,
    maintenance:           templates.maintenanceEmail,
    important_update:      templates.importantUpdateEmail,
    custom_bulk:           templates.customBulkEmail,
  };
  return map[type] || null;
}

module.exports = { sendEmail, queueEmail, getTemplateFn };
