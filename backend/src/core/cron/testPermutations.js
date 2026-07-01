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

async function testPermutations() {
  const password = process.env.SHOONYA_PASSWORD;
  const totpSecret = process.env.SHOONYA_TOTP_SECRET;
  const apiKey = process.env.SHOONYA_API_KEY;
  const pwdHash = sha256(password);
  
  const uids = ["FN219925", "FN219925_U", "06099530"];
  const vcs = ["FN219925_U", "FN219925", "06099530", "FN219925_u"];

  for (const u of uids) {
    for (const v of vcs) {
      const totp = generateTOTP(totpSecret);
      const appKey = `${u}|${apiKey}`;
      const appKeyHash = sha256(appKey);
      
      const payload = {
        source: "API",
        apkversion: "1.0.0",
        uid: u,
        pwd: pwdHash,
        factor2: totp,
        vc: v,
        appkey: appKeyHash,
        imei: "abc1234"
      };

      try {
        console.log(`Testing UID: ${u}, VC: ${v}`);
        const res = await axios.post(
          'https://api.shoonya.com/NorenWClientAPI/QuickAuth',
          `jData=${JSON.stringify(payload)}`,
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 }
        );

        if (res.data && res.data.stat === 'Ok') {
          console.log('\n✅ SUCCESS!');
          console.log(`Working UID: ${u}`);
          console.log(`Working VC: ${v}`);
          return;
        } else {
          console.log('Failed:', res.data.emsg);
        }
      } catch (err) {
        if (err.response) {
           console.log('Failed HTTP:', err.response.data.emsg);
        } else {
           console.log('Failed Error:', err.message);
        }
      }
    }
  }
}

testPermutations();
