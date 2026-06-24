require('dotenv').config();
const { supabaseAdmin } = require('./src/config/supabase');

async function check() {
  const { data, error } = await supabaseAdmin.from('instruments').select('symbol, last_price').limit(20);
  console.log("Error:", error);
  console.log("Data:", data);
}

check();
