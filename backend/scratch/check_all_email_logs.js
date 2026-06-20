require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLogs() {
  const { data, error } = await supabase
    .from('email_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) {
    console.error('Error fetching logs:', error);
  } else {
    console.log('Recent 20 Email Logs:');
    data.forEach(log => {
      console.log(`[${log.created_at}] To: ${log.email_to} | Type: ${log.type} | Status: ${log.status} | Err: ${log.error_message}`);
    });
  }
}

checkLogs();
