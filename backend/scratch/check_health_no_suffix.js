

async function checkHealth() {
  try {
    const res = await fetch('https://stockslab-backend.onrender.com/health');
    console.log('Status (no suffix):', res.status);
    const text = await res.text();
    console.log('Body:', text);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkHealth();
