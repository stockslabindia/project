

async function checkHealth() {
  try {
    const res = await fetch('https://stockslab-backend-9570.onrender.com/health');
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkHealth();
