async function testLocalOtpFlow() {
  const random = Math.floor(Math.random() * 1000000);
  const email = `testuser_${random}@example.com`;
  const phone = `+919999${String(random).padStart(6, '0')}`;
  
  const signupPayload = {
    email: email,
    password: 'Password123!',
    full_name: 'Test Local User',
    phone: phone
  };

  console.log('1. Sending signup request to local backend...');
  try {
    const signupRes = await fetch('http://localhost:4000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signupPayload)
    });

    console.log('Signup HTTP Status:', signupRes.status);
    const signupData = await signupRes.json();
    console.log('Signup Response Data:', JSON.stringify(signupData, null, 2));

    if (signupData.requires_otp && signupData.user && signupData.user.id) {
      const userId = signupData.user.id;
      console.log(`\n2. Attempting OTP Verification for userId: ${userId} with bypass code 123456...`);

      const verifyPayload = {
        userId: userId,
        otp: '123456',
        email: email,
        password: 'Password123!'
      };

      const verifyRes = await fetch('http://localhost:4000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload)
      });

      console.log('Verify HTTP Status:', verifyRes.status);
      const verifyData = await verifyRes.json();
      console.log('Verify Response Data:', JSON.stringify(verifyData, null, 2));

      if (verifyRes.ok) {
        console.log('\n✅ Local OTP flow verification successful!');
      } else {
        console.error('\n❌ Local OTP verification failed.');
      }
    } else {
      console.error('\n❌ Signup did not return requires_otp or user info.');
    }
  } catch (err) {
    console.error('Error during execution:', err.message);
  }
}

testLocalOtpFlow();
