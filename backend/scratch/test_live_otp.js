const axios = require('axios');

async function testLiveOtp() {
  const authKey = 'k5M0jq6QoVYZ9PbxofjS9SwOzMFySEF--7vT-MLPYL0';
  
  // Replace this with your actual phone number to test (with country code e.g. '919999999999')
  const testMobile = process.argv[2]; 
  const channel = process.argv[3] || 'whatsapp'; // 'whatsapp' or 'sms'

  if (!testMobile) {
    console.error('Usage: node test_live_otp.js <mobile_number_with_country_code> [channel]');
    console.error('Example: node test_live_otp.js 919999999999 sms');
    process.exit(1);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`Sending OTP: ${otp} to ${testMobile} via channel: ${channel}...`);

  try {
    const params = new URLSearchParams();
    params.append('authkey', authKey);
    params.append('mobile', testMobile);
    params.append('otp', otp);
    params.append('channel', channel);
    if (channel === 'whatsapp') {
      params.append('template_name', 'verification_otp');
    }

    const response = await axios.post('https://apitxt.com/api/sendOTP', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('HTTP Status:', response.status);
    console.log('Response Body:', response.data);
  } catch (err) {
    console.error('Error sending OTP:', err.response?.data ? JSON.stringify(err.response.data) : err.message);
  }
}

testLiveOtp();
