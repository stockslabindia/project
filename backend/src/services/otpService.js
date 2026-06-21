const axios = require('axios');
const { feedLogger } = require('../core/monitoring/logger');

/**
 * Send an OTP code to a mobile number via APITxT.
 * 
 * @param {string} mobile - Recipient mobile number with country code (e.g., '919999999999')
 * @param {string} otp - The 6-digit numeric OTP code
 * @returns {Promise<boolean>} - True if sent successfully, false otherwise
 */
async function sendOtp(mobile, otp) {
  const authKey = process.env.APITXT_AUTH_KEY;
  if (!authKey) {
    feedLogger.warn('[OTP Service] APITXT_AUTH_KEY is not set. OTP send skipped. Dev OTP: ' + otp);
    return true; // Bypass in dev if key not configured
  }

  // Clean mobile number: remove spaces, hyphens, and leading plus sign
  const cleanedMobile = mobile.replace(/[\s\-\+]/g, '');

  const channel = process.env.APITXT_CHANNEL || 'whatsapp';
  const templateName = process.env.APITXT_WHATSAPP_TEMPLATE || 'verification_otp';
  const projectRefId = process.env.APITXT_PROJECT_REF_ID;

  try {
    feedLogger.info(`[OTP Service] Sending OTP to ${cleanedMobile} via channel: ${channel}`);
    
    // Prepare urlencoded form data params
    const params = new URLSearchParams();
    params.append('authkey', authKey);
    params.append('mobile', cleanedMobile);
    params.append('otp', otp);
    params.append('channel', channel);
    if (channel === 'whatsapp') {
      params.append('template_name', templateName);
      if (projectRefId) {
        params.append('project_ref_id', projectRefId);
      }
    }

    const response = await axios.post('https://apitxt.com/api/sendOTP', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    if (response.status === 200) {
      feedLogger.info(`[OTP Service] APITxT response: ${JSON.stringify(response.data)}`);
      return true;
    } else {
      feedLogger.error(`[OTP Service] APITxT returned status ${response.status}: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (err) {
    feedLogger.error(`[OTP Service] APITxT request failed: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`);
    return false;
  }
}

module.exports = {
  sendOtp
};
