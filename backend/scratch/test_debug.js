

async function testDebug() {
  try {
    const res = await fetch('https://stockslab-backend-9570.onrender.com/api/instruments/debug');
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testDebug();
