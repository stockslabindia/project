/**
 * emailTemplates.js
 * Premium branded HTML email templates for StocksLab India
 * All templates use inline CSS for maximum email client compatibility.
 * Branding (logo, colors) can be updated in the BRAND constants below.
 */

// ── Brand Constants (update once logo/colors are finalized) ──
const BRAND = {
  name: 'StocksLab India',
  primaryColor: '#1a56db',       // Blue - update with final brand color
  primaryDark: '#1e429f',
  accentColor: '#0ea5e9',
  successColor: '#059669',
  dangerColor: '#dc2626',
  warningColor: '#d97706',
  bgDark: '#0f172a',             // Dark header background
  bgLight: '#f8fafc',
  textDark: '#0f172a',
  textMuted: '#64748b',
  website: 'https://stockslab.live',
  supportEmail: 'support@stockslab.live',
  logoText: 'StocksLab',         // Used until actual logo is added
  unsubscribeBase: 'https://stockslab.live/unsubscribe',
};

// ── Base Layout ──
function baseLayout({ preheader = '', body, isMarketing = false, userId = null }) {
  const unsubscribeUrl = isMarketing && userId
    ? `${BRAND.unsubscribeBase}?uid=${userId}`
    : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${BRAND.name}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f1f5f9;">
    ${preheader}&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;
  </div>

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:600px;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.bgDark} 0%,#1e293b 100%);border-radius:16px 16px 0 0;padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-flex;align-items:center;gap:10px;">
                      <!-- Logo placeholder - replace src with actual logo URL -->
                      <div style="width:36px;height:36px;background:${BRAND.primaryColor};border-radius:8px;display:inline-block;text-align:center;line-height:36px;font-size:18px;font-weight:900;color:white;letter-spacing:-1px;">S</div>
                      <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${BRAND.logoText}</span>
                    </div>
                  </td>
                  <td align="right">
                    <span style="font-size:11px;font-weight:600;color:#64748b;letter-spacing:1px;text-transform:uppercase;">Trading Platform</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;line-height:1.6;">
                      This email was sent by <strong style="color:#64748b;">${BRAND.name}</strong> · 
                      <a href="${BRAND.website}" style="color:${BRAND.primaryColor};text-decoration:none;">${BRAND.website}</a>
                    </p>
                    <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
                      Questions? Email us at <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primaryColor};text-decoration:none;">${BRAND.supportEmail}</a>
                    </p>
                    ${unsubscribeUrl ? `
                    <p style="margin:0;font-size:11px;color:#cbd5e1;">
                      Don't want these emails? <a href="${unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>
                    </p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ── Shared Helpers ──
function statusBanner(icon, text, color, bg) {
  return `
  <div style="background:${bg};border:1.5px solid ${color}22;border-radius:10px;padding:14px 20px;margin-bottom:28px;display:flex;align-items:center;gap:12px;">
    <span style="font-size:22px;line-height:1;">${icon}</span>
    <span style="font-size:15px;font-weight:700;color:${color};">${text}</span>
  </div>`;
}

function greeting(name) {
  return `<p style="margin:0 0 20px;font-size:16px;color:#0f172a;line-height:1.6;">Hi <strong>${name}</strong>,</p>`;
}

function infoTable(rows) {
  const cells = rows.map(([label, value, valueColor]) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;color:#64748b;width:45%;">${label}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:700;color:${valueColor || '#0f172a'};text-align:right;">${value}</td>
    </tr>`).join('');

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:28px;">
    <tbody>${cells}</tbody>
  </table>`;
}

function ctaButton(text, url, color = BRAND.primaryColor) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr>
      <td align="center">
        <a href="${url}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.2px;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;
}

function signature() {
  return `
  <p style="margin:28px 0 0;font-size:14px;color:#64748b;line-height:1.7;">
    Warm regards,<br/>
    <strong style="color:#0f172a;">The ${BRAND.name} Team</strong>
  </p>`;
}

// ═══════════════════════════════════════════════════
// 1. WELCOME EMAIL
// ═══════════════════════════════════════════════════
function welcomeEmail({ name, clientId }) {
  const body = `
    ${statusBanner('🎉', 'Welcome to StocksLab India!', BRAND.primaryColor, '#eff6ff')}
    ${greeting(name)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      Your trading account has been created successfully. You're now part of India's next-generation dabba trading platform.
    </p>
    ${infoTable([
      ['Your Client ID', clientId, BRAND.primaryColor],
      ['Account Status', 'Active ✓', BRAND.successColor],
      ['Platform', 'StocksLab India', '#0f172a'],
    ])}
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;">
      To start trading, complete these steps:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${[
        ['1', 'Complete KYC Verification', 'Required for withdrawals'],
        ['2', 'Add a Bank Account', 'For seamless withdrawals'],
        ['3', 'Fund Your Wallet', 'Minimum deposit ₹500'],
        ['4', 'Start Trading', 'Access all markets'],
      ].map(([num, title, desc]) => `
        <tr>
          <td style="padding:10px 0;vertical-align:top;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:32px;height:32px;background:${BRAND.primaryColor};border-radius:50%;text-align:center;vertical-align:middle;">
                  <span style="font-size:13px;font-weight:800;color:#fff;">${num}</span>
                </td>
                <td style="padding-left:14px;vertical-align:middle;">
                  <div style="font-size:14px;font-weight:700;color:#0f172a;">${title}</div>
                  <div style="font-size:12px;color:#64748b;">${desc}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`).join('')}
    </table>
    ${ctaButton('Open Trading Platform →', BRAND.website)}
    ${signature()}`;

  return {
    subject: `Welcome to StocksLab India, ${name}! 🎉`,
    html: baseLayout({ preheader: `Your account is ready. Client ID: ${clientId}`, body }),
  };
}

// ═══════════════════════════════════════════════════
// 2. BANK ACCOUNT ADDED
// ═══════════════════════════════════════════════════
function bankAccountAddedEmail({ name, bankName, accountNumber }) {
  const maskedAccount = accountNumber ? `****${String(accountNumber).slice(-4)}` : '****';
  const body = `
    ${statusBanner('🏦', 'Bank Account Added Successfully', BRAND.successColor, '#f0fdf4')}
    ${greeting(name)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      A new bank account has been linked to your StocksLab India trading account.
    </p>
    ${infoTable([
      ['Bank Name', bankName],
      ['Account Number', maskedAccount],
      ['Status', 'Linked ✓', BRAND.successColor],
    ])}
    <div style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
        <strong>🔒 Security Notice:</strong> If you did not add this bank account, please contact our support team immediately at <a href="mailto:${BRAND.supportEmail}" style="color:#92400e;font-weight:700;">${BRAND.supportEmail}</a>
      </p>
    </div>
    ${ctaButton('View My Bank Accounts →', `${BRAND.website}/profile`)}
    ${signature()}`;

  return {
    subject: `Bank Account Added — ${bankName} (${maskedAccount})`,
    html: baseLayout({ preheader: `New bank account linked: ${bankName} ${maskedAccount}`, body }),
  };
}

// ═══════════════════════════════════════════════════
// 3. BANK ACCOUNT REMOVED
// ═══════════════════════════════════════════════════
function bankAccountRemovedEmail({ name, bankName, accountNumber }) {
  const maskedAccount = accountNumber ? `****${String(accountNumber).slice(-4)}` : '****';
  const body = `
    ${statusBanner('🗑️', 'Bank Account Removed', BRAND.warningColor, '#fffbeb')}
    ${greeting(name)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      The following bank account has been removed from your StocksLab India trading account.
    </p>
    ${infoTable([
      ['Bank Name', bankName],
      ['Account Number', maskedAccount],
      ['Status', 'Removed', BRAND.dangerColor],
    ])}
    <div style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:8px;padding:14px 18px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
        <strong>🔒 Security Notice:</strong> If you did not remove this bank account, please contact us immediately at <a href="mailto:${BRAND.supportEmail}" style="color:#92400e;font-weight:700;">${BRAND.supportEmail}</a>
      </p>
    </div>
    ${ctaButton('Manage Bank Accounts →', `${BRAND.website}/profile`)}
    ${signature()}`;

  return {
    subject: `Bank Account Removed — ${bankName} (${maskedAccount})`,
    html: baseLayout({ preheader: `Bank account ${maskedAccount} has been removed from your account`, body }),
  };
}

// ═══════════════════════════════════════════════════
// 4. DEPOSIT APPROVED
// ═══════════════════════════════════════════════════
function depositApprovedEmail({ name, amount, newBalance, referenceId, method }) {
  const body = `
    ${statusBanner('✅', 'Deposit Approved & Credited', BRAND.successColor, '#f0fdf4')}
    ${greeting(name)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      Great news! Your deposit has been verified and credited to your trading wallet.
    </p>

    <!-- Amount highlight box -->
    <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
      <div style="font-size:13px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Amount Credited</div>
      <div style="font-size:36px;font-weight:900;color:#15803d;letter-spacing:-1px;">₹${Number(amount).toLocaleString('en-IN')}</div>
    </div>

    ${infoTable([
      ['Reference ID', referenceId ? String(referenceId).split('-')[0].toUpperCase() : 'N/A'],
      ['Payment Method', method || 'Bank Transfer'],
      ['Status', 'Approved ✓', BRAND.successColor],
      ['New Wallet Balance', `₹${Number(newBalance || 0).toLocaleString('en-IN')}`, BRAND.successColor],
    ])}
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;">
      Your funds are now available and you can start trading immediately.
    </p>
    ${ctaButton('Start Trading Now →', BRAND.website)}
    ${signature()}`;

  return {
    subject: `✅ Deposit of ₹${Number(amount).toLocaleString('en-IN')} Approved`,
    html: baseLayout({ preheader: `Your deposit of ₹${Number(amount).toLocaleString('en-IN')} has been approved and credited to your wallet`, body }),
  };
}

// ═══════════════════════════════════════════════════
// 5. DEPOSIT REJECTED
// ═══════════════════════════════════════════════════
function depositRejectedEmail({ name, amount, reason, referenceId }) {
  const body = `
    ${statusBanner('❌', 'Deposit Request Rejected', BRAND.dangerColor, '#fef2f2')}
    ${greeting(name)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      Unfortunately, your deposit request could not be approved. Please review the details below.
    </p>
    ${infoTable([
      ['Amount Requested', `₹${Number(amount).toLocaleString('en-IN')}`],
      ['Reference ID', referenceId ? String(referenceId).split('-')[0].toUpperCase() : 'N/A'],
      ['Status', 'Rejected', BRAND.dangerColor],
    ])}
    <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Rejection Reason</div>
      <div style="font-size:14px;color:#7f1d1d;line-height:1.6;">${reason || 'The payment could not be verified. Please ensure the payment details and UTR number are correct.'}</div>
    </div>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;">
      You can submit a new deposit request with the correct details. If you believe this is an error, please contact our support team.
    </p>
    ${ctaButton('Try Again →', `${BRAND.website}/wallet`)}
    <p style="margin:0;font-size:13px;color:#64748b;text-align:center;">
      Need help? Email us at <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primaryColor};">${BRAND.supportEmail}</a>
    </p>
    ${signature()}`;

  return {
    subject: `❌ Deposit of ₹${Number(amount).toLocaleString('en-IN')} Could Not Be Approved`,
    html: baseLayout({ preheader: `Your deposit request of ₹${Number(amount).toLocaleString('en-IN')} was rejected`, body }),
  };
}

// ═══════════════════════════════════════════════════
// 6. WITHDRAWAL APPROVED
// ═══════════════════════════════════════════════════
function withdrawalApprovedEmail({ name, amount, bankName, accountNumber }) {
  const maskedAccount = accountNumber ? `****${String(accountNumber).slice(-4)}` : '****';
  const body = `
    ${statusBanner('✅', 'Withdrawal Approved', BRAND.successColor, '#f0fdf4')}
    ${greeting(name)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      Your withdrawal request has been approved. The funds will be transferred to your bank account within 1–3 business days.
    </p>

    <!-- Amount highlight box -->
    <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
      <div style="font-size:13px;font-weight:600;color:#16a34a;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Withdrawal Amount</div>
      <div style="font-size:36px;font-weight:900;color:#15803d;letter-spacing:-1px;">₹${Number(amount).toLocaleString('en-IN')}</div>
    </div>

    ${infoTable([
      ['Bank Name', bankName || 'On file'],
      ['Account Number', maskedAccount],
      ['Transfer Method', 'NEFT / IMPS'],
      ['Expected Time', '1–3 Business Days'],
      ['Status', 'Approved ✓', BRAND.successColor],
    ])}
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;">
      Once the transfer is processed by the bank, you will receive funds in the above account.
    </p>
    ${ctaButton('View Wallet →', `${BRAND.website}/wallet`)}
    ${signature()}`;

  return {
    subject: `✅ Withdrawal of ₹${Number(amount).toLocaleString('en-IN')} Approved`,
    html: baseLayout({ preheader: `Your withdrawal of ₹${Number(amount).toLocaleString('en-IN')} has been approved and is being processed`, body }),
  };
}

// ═══════════════════════════════════════════════════
// 7. WITHDRAWAL REJECTED
// ═══════════════════════════════════════════════════
function withdrawalRejectedEmail({ name, amount, reason }) {
  const body = `
    ${statusBanner('❌', 'Withdrawal Request Rejected', BRAND.dangerColor, '#fef2f2')}
    ${greeting(name)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      We were unable to process your withdrawal request. Your funds have <strong>not</strong> been deducted from your wallet.
    </p>
    ${infoTable([
      ['Amount Requested', `₹${Number(amount).toLocaleString('en-IN')}`],
      ['Status', 'Rejected — Funds Returned', BRAND.dangerColor],
    ])}
    <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Rejection Reason</div>
      <div style="font-size:14px;color:#7f1d1d;line-height:1.6;">${reason || 'The withdrawal request could not be processed. Please verify your bank account details and try again.'}</div>
    </div>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;">
      Your wallet balance remains unchanged. You may submit a new withdrawal request after resolving the issue.
    </p>
    ${ctaButton('Retry Withdrawal →', `${BRAND.website}/wallet`)}
    <p style="margin:0;font-size:13px;color:#64748b;text-align:center;">
      Need help? <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primaryColor};">${BRAND.supportEmail}</a>
    </p>
    ${signature()}`;

  return {
    subject: `❌ Withdrawal of ₹${Number(amount).toLocaleString('en-IN')} Could Not Be Processed`,
    html: baseLayout({ preheader: `Your withdrawal request was rejected. Your funds are safe in your wallet.`, body }),
  };
}

// ═══════════════════════════════════════════════════
// 8. KYC APPROVED
// ═══════════════════════════════════════════════════
function kycApprovedEmail({ name, clientId }) {
  const body = `
    ${statusBanner('🛡️', 'KYC Verification Approved!', BRAND.successColor, '#f0fdf4')}
    ${greeting(name)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      Your identity has been verified successfully. Your account is now fully activated with all trading and withdrawal features unlocked.
    </p>
    ${infoTable([
      ['Client ID', clientId, BRAND.primaryColor],
      ['KYC Status', 'Verified ✓', BRAND.successColor],
      ['Withdrawals', 'Unlocked ✓', BRAND.successColor],
      ['Trading Limits', 'Full Access ✓', BRAND.successColor],
    ])}
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;">
      You can now:
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${['Withdraw funds to your bank account anytime', 'Access higher trading limits', 'Participate in all market segments', 'Avail all platform features without restrictions'].map(item => `
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#374151;">
            <span style="color:${BRAND.successColor};font-weight:700;margin-right:10px;">✓</span>${item}
          </td>
        </tr>`).join('')}
    </table>
    ${ctaButton('Start Trading →', BRAND.website)}
    ${signature()}`;

  return {
    subject: `🛡️ KYC Approved — Your Account is Fully Verified`,
    html: baseLayout({ preheader: `Congratulations! Your KYC has been approved. All account features are now unlocked.`, body }),
  };
}

// ═══════════════════════════════════════════════════
// 9. KYC REJECTED
// ═══════════════════════════════════════════════════
function kycRejectedEmail({ name, reason }) {
  const commonReasons = [
    'Blurry or unreadable document images',
    'Expired document',
    'Name mismatch between documents',
    'Incomplete document submission',
  ];

  const body = `
    ${statusBanner('⚠️', 'KYC Verification Unsuccessful', BRAND.warningColor, '#fffbeb')}
    ${greeting(name)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      We were unable to verify your identity at this time. Please review the reason and resubmit your documents.
    </p>
    <div style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Rejection Reason</div>
      <div style="font-size:14px;color:#78350f;line-height:1.6;font-weight:500;">${reason || 'The submitted documents could not be verified. Please ensure all documents are clear, valid, and match your profile.'}</div>
    </div>
    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0f172a;">Common fixes:</p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${commonReasons.map(item => `
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#374151;">
            <span style="color:${BRAND.warningColor};font-weight:700;margin-right:10px;">→</span>${item}
          </td>
        </tr>`).join('')}
    </table>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;">
      You can resubmit your KYC documents through the app. Make sure images are clear, fully visible, and not expired.
    </p>
    ${ctaButton('Resubmit KYC Documents →', `${BRAND.website}/profile`)}
    <p style="margin:0;font-size:13px;color:#64748b;text-align:center;">
      Need help? <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primaryColor};">${BRAND.supportEmail}</a>
    </p>
    ${signature()}`;

  return {
    subject: `⚠️ KYC Verification — Action Required`,
    html: baseLayout({ preheader: `Your KYC documents need to be resubmitted. Please review the reason and try again.`, body }),
  };
}

// ═══════════════════════════════════════════════════
// 10. SYSTEM MAINTENANCE (Bulk)
// ═══════════════════════════════════════════════════
function maintenanceEmail({ name, title, message, scheduledTime, userId }) {
  const body = `
    ${statusBanner('🔧', 'Scheduled System Maintenance', BRAND.warningColor, '#fffbeb')}
    ${greeting(name)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      We want to inform you about upcoming scheduled maintenance on the StocksLab India platform.
    </p>
    <div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
      <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:8px;">${title}</div>
      <div style="font-size:14px;color:#374151;line-height:1.7;">${message}</div>
      ${scheduledTime ? `
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid #fde68a;">
        <span style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">Scheduled Time: </span>
        <span style="font-size:13px;font-weight:700;color:#0f172a;">${scheduledTime}</span>
      </div>` : ''}
    </div>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.7;">
      During this window, the platform and trading services may be temporarily unavailable. We recommend closing any open positions before the maintenance window.
    </p>
    <p style="margin:0 0 4px;font-size:14px;color:#374151;">We apologize for any inconvenience and appreciate your patience.</p>
    ${signature()}`;

  return {
    subject: `🔧 Maintenance Notice: ${title}`,
    html: baseLayout({ preheader: `Important: Scheduled maintenance — ${title}`, body, isMarketing: true, userId }),
  };
}

// ═══════════════════════════════════════════════════
// 11. IMPORTANT UPDATE (Bulk)
// ═══════════════════════════════════════════════════
function importantUpdateEmail({ name, title, message, ctaText, ctaUrl, userId }) {
  const body = `
    ${statusBanner('📢', 'Important Platform Update', BRAND.primaryColor, '#eff6ff')}
    ${greeting(name)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
      We have an important update about the StocksLab India trading platform.
    </p>
    <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
      <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:10px;">${title}</div>
      <div style="font-size:14px;color:#374151;line-height:1.7;">${message}</div>
    </div>
    ${ctaText && ctaUrl ? ctaButton(`${ctaText} →`, ctaUrl) : ''}
    ${signature()}`;

  return {
    subject: `📢 ${title}`,
    html: baseLayout({ preheader: title, body, isMarketing: true, userId }),
  };
}

// ═══════════════════════════════════════════════════
// 12. CUSTOM BULK EMAIL
// ═══════════════════════════════════════════════════
function customBulkEmail({ name, subject, title, message, ctaText, ctaUrl, userId }) {
  const body = `
    ${greeting(name)}
    <div style="margin-bottom:28px;">
      <div style="font-size:22px;font-weight:800;color:#0f172a;line-height:1.3;margin-bottom:16px;">${title}</div>
      <div style="font-size:15px;color:#374151;line-height:1.8;white-space:pre-line;">${message}</div>
    </div>
    ${ctaText && ctaUrl ? ctaButton(`${ctaText} →`, ctaUrl) : ''}
    ${signature()}`;

  return {
    subject,
    html: baseLayout({ preheader: title, body, isMarketing: true, userId }),
  };
}

// ── Exports ──
module.exports = {
  welcomeEmail,
  bankAccountAddedEmail,
  bankAccountRemovedEmail,
  depositApprovedEmail,
  depositRejectedEmail,
  withdrawalApprovedEmail,
  withdrawalRejectedEmail,
  kycApprovedEmail,
  kycRejectedEmail,
  maintenanceEmail,
  importantUpdateEmail,
  customBulkEmail,
};
