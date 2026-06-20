

async function testSignup() {
  const random = Math.floor(Math.random() * 1000000);
  const email = `testuser_${random}@example.com`;
  const phone = `+919999${String(random).padStart(6, '0')}`;
  
  const payload = {
    email: email,
    password: 'Password123!',
    full_name: 'Test User',
    phone: phone
  };

  console.log('Sending signup request with payload:', payload);

  try {
    const res = await fetch('https://stockslab-backend-9570.onrender.com/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('Response status:', res.status);
    const data = await res.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testSignup();
