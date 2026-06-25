require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const crypto = require('crypto');
const axios = require('axios');

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function decodeBase32(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const buffer = [];
  const cleanSecret = base32.replace(/[\s=]/g, '').toUpperCase();
  for (let i = 0; i < cleanSecret.length; i++) {
    const val = alphabet.indexOf(cleanSecret[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    buffer.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(buffer);
}

function generateTOTP(secretBase32) {
  const secret = decodeBase32(secretBase32);
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(timeStep), 0);
  const hmac = crypto.createHmac('sha1', secret).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
  ) % 1000000;
  return code.toString().padStart(6, '0');
}

async function fetchShoonyaToken() {
  const userId = process.env.SHOONYA_USER_ID;
  const password = process.env.SHOONYA_PASSWORD;
  const totpSecret = process.env.SHOONYA_TOTP_SECRET;
  const vendorCode = process.env.SHOONYA_VENDOR_CODE || `${userId}_U`;
  const apiKey = process.env.SHOONYA_API_KEY;
  const imei = process.env.SHOONYA_IMEI || 'abc1234';

  if (!userId || !password || !totpSecret || !apiKey) {
    console.error('[SHOONYA LOGIN] Missing credentials');
    return null;
  }

  const pwdHash = sha256(password);
  const totp = generateTOTP(totpSecret);
  const appKey = `${userId}|${apiKey}`;
  const appKeyHash = sha256(appKey);

  const payload = {
    source: "API",
    apkversion: "1.0.0",
    uid: userId,
    pwd: pwdHash,
    factor2: totp,
    vc: vendorCode,
    appkey: appKeyHash,
    imei: imei
  };

  try {
    const res = await axios.post(
      'https://api.shoonya.com/NorenWClientAPI/QuickAuth',
      `jData=${JSON.stringify(payload)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    if (res.data && res.data.stat === 'Ok') {
      console.log('[SHOONYA LOGIN] Successfully obtained susertoken:', res.data.susertoken);
      
      try {
        const { redisClient } = require('../../redis/client');
        if (redisClient) {
          await redisClient.set('shoonya_susertoken', res.data.susertoken, 'EX', 86400);
        }
      } catch(e) {}
      
      return res.data.susertoken;
    } else {
      console.error('[SHOONYA LOGIN] QuickAuth failed:', res.data);
      return null;
    }
  } catch (err) {
    if (err.response) {
      if (err.response.data && err.response.data.emsg && err.response.data.emsg.includes('Invalid Vendor code')) {
        console.error('[SHOONYA LOGIN] IP Whitelist Error! Shoonya rejected the request. Ensure the IP running this code is exactly whitelisted in Shoonya Portal.');
      } else {
        console.error('[SHOONYA LOGIN] Request error:', err.response.data);
      }
    } else {
      console.error('[SHOONYA LOGIN] Request error:', err.message);
    }
    return null;
  }
}

if (require.main === module) {
  fetchShoonyaToken();
}

module.exports = { fetchShoonyaToken };
