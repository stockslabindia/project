/**
 * test_email_send.js
 * Test script to verify Resend sending works end-to-end.
 */
require('dotenv').config();

const { sendEmail } = require('../src/services/emailService');
const templates = require('../src/services/emailTemplates');

async function run() {
  const recipient = process.argv[2];
  if (!recipient) {
    console.error('Please specify a recipient email: node scratch/test_email_send.js <email>');
    process.exit(1);
  }

  console.log('Sending welcome email test to:', recipient);
  const payload = {
    to: recipient,
    name: 'Test Trader',
    clientId: 'SL99999',
  };

  const { subject, html } = templates.welcomeEmail(payload);

  const res = await sendEmail({
    to: recipient,
    subject,
    html,
    type: 'welcome',
  });

  console.log('Result:', res);
  process.exit(res.success ? 0 : 1);
}

run();
