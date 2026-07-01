require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const crypto = require('crypto');
const axios = require('axios');
const puppeteer = require('puppeteer');
const fs = require('fs');

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

async function run() {
  const userId = process.env.SHOONYA_USER_ID;
  const password = process.env.SHOONYA_PASSWORD;
  const totpSecret = process.env.SHOONYA_TOTP_SECRET;
  const clientId = process.env.SHOONYA_CLIENT_ID || '06099530';
  const apiKey = process.env.SHOONYA_API_KEY;

  if (!userId || !password || !totpSecret) {
    console.error('[Error] Missing Shoonya credentials in .env');
    return;
  }

  const loginUrl = `https://api.shoonya.com/OAuthlogin/investor-entry-level/login?api_key=${clientId}&route_to=${userId}`;

  console.log('[Puppeteer] Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  let authCode = null;

  page.on('request', request => {
    const url = request.url();
    if (url.includes('code=')) {
      try {
        const urlObj = new URL(url);
        if (urlObj.searchParams.has('code')) {
          authCode = urlObj.searchParams.get('code');
          console.log('[Puppeteer] Captured auth code:', authCode, 'from URL:', url);
        }
      } catch (e) {}
    }
  });

  try {
    console.log('[Puppeteer] Navigating to', loginUrl);
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });

    await page.waitForSelector("#lgnpwd", { timeout: 10000 });
    
    console.log('[Puppeteer] Filling credentials...');
    
    await page.type('#lgnusrid', userId, { delay: 50 });
    await page.type('#lgnpwd', password, { delay: 50 });
    
    const totpCode = generateTOTP(totpSecret);
    console.log('[Puppeteer] Injecting TOTP:', totpCode);
    await page.type('#lgnotp', totpCode, { delay: 50 });
    
    console.log('[Puppeteer] Clicking Login...');
    // Dispatch input events just in case it's a Vue reactive form
    await page.evaluate(() => {
      document.querySelector('#lgnusrid').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#lgnpwd').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#lgnotp').dispatchEvent(new Event('input', { bubbles: true }));
    });
    
    await page.waitForSelector('.lgnBtnClss');
    await page.click('.lgnBtnClss');

    let attempts = 0;
    while (!authCode && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    if (!authCode) {
      console.log('[Puppeteer] Timeout waiting for auth code. Taking screenshot...');
      await page.screenshot({ path: 'error_screenshot_2.png' });
      const html = await page.content();
      fs.writeFileSync('error_page_2.html', html);
    }
  } catch (err) {
    console.error('[Puppeteer] Error during login flow:', err.message);
  } finally {
    await browser.close();
  }

  if (!authCode) {
    console.error('[OAuth] Failed to retrieve auth code.');
    process.exit(1);
  }

  console.log('[OAuth] Exchanging auth code for susertoken...');
  
  const hashInput = `${clientId}${apiKey}${authCode}`;
  const appVerifier = sha256(hashInput);

  const payload = {
    code: authCode,
    checksum: appVerifier,
    uid: userId
  };

  try {
    const res = await axios.post(
      'https://api.shoonya.com/NorenWClientAPI/GenAcsTok',
      `jData=${JSON.stringify(payload)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    console.log('[OAuth] GenAcsTok Response:', res.status, res.data);
    if (res.data && res.data.stat === 'Ok') {
      console.log('[SUCCESS] Successfully obtained susertoken:', res.data.susertoken);
    }
  } catch (err) {
    console.error('[OAuth] Request failed:', err.response ? err.response.data : err.message);
  }
}

run();
