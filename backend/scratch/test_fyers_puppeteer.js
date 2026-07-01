require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');

function b32decode(s) {
  const a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits=''; const buf=[];
  for(const c of s.replace(/[\s=]/g,'').toUpperCase()){const v=a.indexOf(c);if(v<0)continue;bits+=v.toString(2).padStart(5,'0');}
  for(let i=0;i+8<=bits.length;i+=8)buf.push(parseInt(bits.substring(i,i+8),2));
  return Buffer.from(buf);
}
function totp(s){
  const k=b32decode(s),t=Math.floor(Date.now()/1000/30),b=Buffer.alloc(8);b.writeBigInt64BE(BigInt(t),0);
  const h=crypto.createHmac('sha1',k).update(b).digest(),o=h[h.length-1]&0xf;
  const c=(((h[o]&0x7f)<<24)|((h[o+1]&0xff)<<16)|((h[o+2]&0xff)<<8)|(h[o+3]&0xff))%1e6;
  return c.toString().padStart(6,'0');
}

async function run() {
  const appIdShort = process.env.FYERS_APP_ID.split('-')[0];
  const redirectUri = process.env.FYERS_REDIRECT_URL || 'http://127.0.0.1';
  const loginUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${appIdShort}-100&redirect_uri=${redirectUri}&response_type=code&state=None`;

  console.log('Opening:', loginUrl);
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1280, height: 800 });

  let authCode = null;
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith(redirectUri) && url.includes('auth_code=')) {
      const match = url.match(/[?&]auth_code=([^&]+)/);
      if (match) {
        authCode = match[1];
        console.log('[Puppeteer] Intercepted auth_code:', authCode);
      }
    }
  });

  try {
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });
    
    // Step 1: Client ID
    await page.waitForSelector('#fy_client_id', { timeout: 10000 });
    // Focus and type explicitly
    await page.focus('#fy_client_id');
    await page.type('#fy_client_id', process.env.FYERS_USER_ID, { delay: 100 });
    
    // Evaluate click to bypass disabled state or non-clickable overlays
    await page.evaluate(() => {
      document.querySelector('#fy_client_id').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#clientIdSubmit').disabled = false;
      document.querySelector('#clientIdSubmit').click();
    });
    console.log('[Puppeteer] Step 1: Submitted Client ID');

    // Wait for network activity to settle
    await new Promise(r => setTimeout(r, 2000));

    // Step 2: TOTP
    await page.waitForSelector('#confirm-otp-page', { visible: true, timeout: 10000 });
    const totpCode = totp(process.env.FYERS_TOTP_SECRET);
    
    const otpSelectors = ['#first', '#second', '#third', '#fourth', '#fifth', '#sixth'];
    for (let i = 0; i < 6; i++) {
      // Must scope to confirm-otp-page as there are multiple #first elements
      const el = await page.$(`#confirm-otp-page ${otpSelectors[i]}`);
      if(el) {
        await el.focus();
        await el.type(totpCode[i], {delay: 50});
      }
    }
    await page.evaluate(() => {
      document.querySelector('#confirmOtpSubmit').disabled = false;
      document.querySelector('#confirmOtpSubmit').click();
    });
    console.log('[Puppeteer] Step 2: Submitted TOTP:', totpCode);

    // Wait for network activity
    await new Promise(r => setTimeout(r, 2000));

    // Step 3: PIN
    await page.waitForSelector('#verify-pin-page', { visible: true, timeout: 10000 });
    const pin = process.env.FYERS_PIN;
    
    const pinSelectors = ['#first', '#second', '#third', '#fourth'];
    for (let i = 0; i < 4; i++) {
      const el = await page.$(`#verify-pin-page ${pinSelectors[i]}`);
      if(el) {
        await el.focus();
        await el.type(pin[i], {delay: 50});
      }
    }
    await page.evaluate(() => {
      document.querySelector('#verifyPinSubmit').disabled = false;
      document.querySelector('#verifyPinSubmit').click();
    });
    console.log('[Puppeteer] Step 3: Submitted PIN');

    // Wait for redirect
    let waitCount = 0;
    while (!authCode && waitCount < 30) {
      await new Promise(r => setTimeout(r, 500));
      waitCount++;
    }

    if (authCode) {
      console.log('\n✅ SUCCESSFULLY AUTOMATED FYERS LOGIN!');
      console.log('✅ Auth Code:', authCode);
      fs.writeFileSync('fyers_auth_code.txt', authCode);
    } else {
      console.log('❌ Failed to capture auth_code in time.');
      await page.screenshot({ path: 'fyers_login_failed.png' });
    }
    
  } catch (err) {
    console.error('[Puppeteer Error]:', err.message);
    await page.screenshot({ path: 'fyers_login_error.png' });
  } finally {
    await browser.close();
  }
}
run();
